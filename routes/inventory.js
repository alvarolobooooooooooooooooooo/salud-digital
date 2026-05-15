const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuid } = require('uuid');
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');
const cloudinary = require('cloudinary').v2;

// ── Cloudinary Configuration ──
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Solo se permiten imágenes JPEG, PNG o WebP'));
  }
});

// Helper para upload a Cloudinary con Promise
const uploadToCloudinary = (buffer, publicId) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { public_id: publicId, resource_type: 'auto' },
      (err, result) => {
        if (err) reject(err);
        else resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
};

// ── Helpers ──
const ALLOWED_TYPES = ['medicamento', 'insumo_medico', 'equipo', 'descartable', 'administrativo', 'otro'];
const ALLOWED_AREAS = ['recepcion', 'consultorio', 'laboratorio', 'farmacia', 'bodega', 'quirofano', 'odontologia', 'otro'];
const ALLOWED_UNITS = ['unidades', 'cajas', 'frascos', 'paquetes', 'ml', 'mg', 'gramos', 'litros', 'otro'];
const ALLOWED_MOVEMENTS = ['entrada', 'salida', 'ajuste', 'perdida', 'vencimiento', 'transferencia'];

function canEdit(req) {
  return req.user.role === 'clinic_admin' || req.user.role === 'super_admin';
}

function deriveStatus(item) {
  const stock = Number(item.current_stock || 0);
  const min = Number(item.min_stock || 0);
  if (stock <= 0) return 'agotado';
  if (min > 0 && stock <= min) return 'bajo_stock';
  return 'disponible';
}

function expirationStatus(item) {
  if (!item.expiration_date) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const exp = new Date(item.expiration_date);
  const diff = Math.floor((exp - today) / (1000 * 60 * 60 * 24));
  const alertDays = Number(item.expiration_alert_days || 30);
  if (diff < 0) return { state: 'vencido', daysLeft: diff };
  if (diff <= alertDays) return { state: 'por_vencer', daysLeft: diff };
  return { state: 'vigente', daysLeft: diff };
}

function decorate(item) {
  if (!item) return item;
  const stockStatus = deriveStatus(item);
  const exp = expirationStatus(item);
  const totalValue = Number(item.current_stock || 0) * Number(item.unit_cost || 0);
  return { ...item, stock_status: stockStatus, expiration_info: exp, total_value: totalValue };
}

function intOrNull(v) { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return isNaN(n) ? null : n; }
function numOrNull(v) { if (v === undefined || v === null || v === '') return null; const n = Number(v); return isNaN(n) ? null : n; }
function num(v, def = 0) { const n = Number(v); return isNaN(n) ? def : n; }
function str(v, def = '') { return v == null ? def : String(v); }
function bool(v, def = false) { if (v === undefined || v === null) return def; if (typeof v === 'boolean') return v; if (typeof v === 'string') return v === 'true' || v === '1'; return Boolean(v); }
function dateOrNull(v) { if (!v) return null; const d = new Date(v); return isNaN(d.getTime()) ? null : v; }

function buildItemPayload(body) {
  return {
    name: str(body.name).trim(),
    description: str(body.description),
    image_url: str(body.image_url),
    sku: str(body.sku).trim(),
    barcode: str(body.barcode).trim(),
    category: str(body.category).trim(),
    type: ALLOWED_TYPES.includes(body.type) ? body.type : 'otro',
    current_stock: num(body.current_stock, 0),
    min_stock: num(body.min_stock, 0),
    max_stock: numOrNull(body.max_stock),
    unit: ALLOWED_UNITS.includes(body.unit) ? body.unit : 'unidades',
    low_stock_alert: bool(body.low_stock_alert, true),
    purchase_date: dateOrNull(body.purchase_date),
    expiration_date: dateOrNull(body.expiration_date),
    expiration_alert_days: intOrNull(body.expiration_alert_days) || 30,
    unit_cost: num(body.unit_cost, 0),
    sale_price: num(body.sale_price, 0),
    currency: str(body.currency, 'HNL'),
    supplier_name: str(body.supplier_name).trim(),
    invoice_number: str(body.invoice_number).trim(),
    purchase_notes: str(body.purchase_notes),
    branch: str(body.branch).trim(),
    area: ALLOWED_AREAS.includes(body.area) ? body.area : '',
    exact_location: str(body.exact_location).trim(),
    responsible_user_id: intOrNull(body.responsible_user_id),
    is_active: bool(body.is_active, true),
    requires_expiration_control: bool(body.requires_expiration_control, false),
    requires_authorization_for_use: bool(body.requires_authorization_for_use, false),
    allow_use_in_appointments: bool(body.allow_use_in_appointments, true),
    internal_notes: str(body.internal_notes)
  };
}

// ── List items ──
router.get('/', authenticate, async (req, res) => {
  try {
    const clinicId = req.user.clinic_id;
    const params = [clinicId];
    let where = 'i.clinic_id = $1';
    const includeArchived = req.query.archived === 'true' || req.query.archived === '1';
    if (!includeArchived) where += ' AND i.is_archived = FALSE';

    if (req.query.search) {
      params.push(`%${req.query.search.toLowerCase()}%`);
      where += ` AND (LOWER(i.name) LIKE $${params.length} OR LOWER(i.sku) LIKE $${params.length} OR LOWER(i.barcode) LIKE $${params.length} OR LOWER(i.description) LIKE $${params.length})`;
    }
    if (req.query.category) {
      params.push(req.query.category);
      where += ` AND i.category = $${params.length}`;
    }
    if (req.query.type) {
      params.push(req.query.type);
      where += ` AND i.type = $${params.length}`;
    }
    if (req.query.area) {
      params.push(req.query.area);
      where += ` AND i.area = $${params.length}`;
    }
    if (req.query.supplier) {
      params.push(`%${req.query.supplier.toLowerCase()}%`);
      where += ` AND LOWER(i.supplier_name) LIKE $${params.length}`;
    }
    if (req.query.expiring_within) {
      const days = parseInt(req.query.expiring_within, 10);
      if (!isNaN(days) && days > 0) {
        where += ` AND i.expiration_date IS NOT NULL AND i.expiration_date <= CURRENT_DATE + INTERVAL '${days} days' AND i.expiration_date >= CURRENT_DATE`;
      }
    }
    if (req.query.expired === 'true') {
      where += ` AND i.expiration_date IS NOT NULL AND i.expiration_date < CURRENT_DATE`;
    }

    const sortMap = {
      name: 'i.name ASC',
      stock: 'i.current_stock ASC',
      expiration: 'i.expiration_date ASC NULLS LAST',
      category: 'i.category ASC, i.name ASC',
      supplier: 'i.supplier_name ASC, i.name ASC',
      recent: 'i.created_at DESC'
    };
    const orderBy = sortMap[req.query.sort] || 'i.name ASC';

    const result = await query(
      `SELECT i.*, u.name AS responsible_user_name
       FROM inventory_items i
       LEFT JOIN users u ON u.id = i.responsible_user_id
       WHERE ${where}
       ORDER BY ${orderBy}`,
      params
    );

    let items = result.rows.map(decorate);

    // Stock status filter is post-decoration
    if (req.query.status) {
      items = items.filter(it => it.stock_status === req.query.status);
    }
    if (req.query.expiration === 'expired') items = items.filter(it => it.expiration_info?.state === 'vencido');
    if (req.query.expiration === 'soon') items = items.filter(it => it.expiration_info?.state === 'por_vencer');

    res.json(items);
  } catch (err) {
    console.error('[inventory] list error:', err);
    res.status(500).json({ error: 'Error obteniendo inventario' });
  }
});

// ── Stats ──
router.get('/stats', authenticate, async (req, res) => {
  try {
    const clinicId = req.user.clinic_id;
    const r = await query(
      `SELECT * FROM inventory_items WHERE clinic_id = $1 AND is_archived = FALSE`,
      [clinicId]
    );
    const items = r.rows.map(decorate);
    const total = items.length;
    const lowStock = items.filter(i => i.stock_status === 'bajo_stock').length;
    const outOfStock = items.filter(i => i.stock_status === 'agotado').length;
    const expiringSoon = items.filter(i => i.expiration_info?.state === 'por_vencer').length;
    const expired = items.filter(i => i.expiration_info?.state === 'vencido').length;
    const estimatedValue = items.reduce((sum, i) => sum + i.total_value, 0);
    const withoutSupplier = items.filter(i => !i.supplier_name).length;
    const withoutLocation = items.filter(i => !i.area && !i.exact_location).length;
    res.json({
      total,
      low_stock: lowStock,
      out_of_stock: outOfStock,
      expiring_soon: expiringSoon,
      expired,
      estimated_value: estimatedValue,
      without_supplier: withoutSupplier,
      without_location: withoutLocation
    });
  } catch (err) {
    console.error('[inventory] stats error:', err);
    res.status(500).json({ error: 'Error obteniendo estadísticas' });
  }
});

// ── Detail ──
router.get('/:id', authenticate, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'ID inválido' });
  const r = await query(
    `SELECT i.*, u.name AS responsible_user_name
     FROM inventory_items i
     LEFT JOIN users u ON u.id = i.responsible_user_id
     WHERE i.id = $1 AND i.clinic_id = $2`,
    [id, req.user.clinic_id]
  );
  if (r.rows.length === 0) return res.status(404).json({ error: 'Artículo no encontrado' });
  res.json(decorate(r.rows[0]));
});

// ── Create ──
router.post('/', authenticate, async (req, res) => {
  if (!canEdit(req)) return res.status(403).json({ error: 'No autorizado' });
  const data = buildItemPayload(req.body);
  if (!data.name) return res.status(400).json({ error: 'El nombre del artículo es obligatorio' });

  try {
    const r = await query(
      `INSERT INTO inventory_items (
        clinic_id, name, description, image_url, sku, barcode, category, type,
        current_stock, min_stock, max_stock, unit, low_stock_alert,
        purchase_date, expiration_date, expiration_alert_days,
        unit_cost, sale_price, currency, supplier_name, invoice_number, purchase_notes,
        branch, area, exact_location, responsible_user_id,
        is_active, requires_expiration_control, requires_authorization_for_use,
        allow_use_in_appointments, internal_notes, created_by
       ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32
       ) RETURNING *`,
      [
        req.user.clinic_id, data.name, data.description, data.image_url, data.sku, data.barcode, data.category, data.type,
        data.current_stock, data.min_stock, data.max_stock, data.unit, data.low_stock_alert,
        data.purchase_date, data.expiration_date, data.expiration_alert_days,
        data.unit_cost, data.sale_price, data.currency, data.supplier_name, data.invoice_number, data.purchase_notes,
        data.branch, data.area, data.exact_location, data.responsible_user_id,
        data.is_active, data.requires_expiration_control, data.requires_authorization_for_use,
        data.allow_use_in_appointments, data.internal_notes, req.user.id
      ]
    );
    const item = r.rows[0];

    if (Number(data.current_stock) > 0) {
      await query(
        `INSERT INTO inventory_movements (inventory_item_id, clinic_id, type, quantity, previous_stock, new_stock, reason, user_id)
         VALUES ($1,$2,'entrada',$3,0,$3,'Stock inicial',$4)`,
        [item.id, req.user.clinic_id, data.current_stock, req.user.id]
      );
    }

    res.json(decorate(item));
  } catch (err) {
    console.error('[inventory] create error:', err);
    res.status(500).json({ error: 'Error creando artículo' });
  }
});

// ── Update ──
router.put('/:id', authenticate, async (req, res) => {
  if (!canEdit(req)) return res.status(403).json({ error: 'No autorizado' });
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'ID inválido' });

  const existing = await query('SELECT * FROM inventory_items WHERE id = $1 AND clinic_id = $2', [id, req.user.clinic_id]);
  if (existing.rows.length === 0) return res.status(404).json({ error: 'Artículo no encontrado' });

  const data = buildItemPayload(req.body);
  if (!data.name) return res.status(400).json({ error: 'El nombre del artículo es obligatorio' });

  try {
    const r = await query(
      `UPDATE inventory_items SET
        name = $1, description = $2, image_url = $3, sku = $4, barcode = $5, category = $6, type = $7,
        current_stock = $8, min_stock = $9, max_stock = $10, unit = $11, low_stock_alert = $12,
        purchase_date = $13, expiration_date = $14, expiration_alert_days = $15,
        unit_cost = $16, sale_price = $17, currency = $18, supplier_name = $19, invoice_number = $20, purchase_notes = $21,
        branch = $22, area = $23, exact_location = $24, responsible_user_id = $25,
        is_active = $26, requires_expiration_control = $27, requires_authorization_for_use = $28,
        allow_use_in_appointments = $29, internal_notes = $30, updated_at = CURRENT_TIMESTAMP
       WHERE id = $31 AND clinic_id = $32 RETURNING *`,
      [
        data.name, data.description, data.image_url, data.sku, data.barcode, data.category, data.type,
        data.current_stock, data.min_stock, data.max_stock, data.unit, data.low_stock_alert,
        data.purchase_date, data.expiration_date, data.expiration_alert_days,
        data.unit_cost, data.sale_price, data.currency, data.supplier_name, data.invoice_number, data.purchase_notes,
        data.branch, data.area, data.exact_location, data.responsible_user_id,
        data.is_active, data.requires_expiration_control, data.requires_authorization_for_use,
        data.allow_use_in_appointments, data.internal_notes,
        id, req.user.clinic_id
      ]
    );

    const before = existing.rows[0];
    const after = r.rows[0];
    const diff = Number(after.current_stock) - Number(before.current_stock);
    if (diff !== 0) {
      await query(
        `INSERT INTO inventory_movements (inventory_item_id, clinic_id, type, quantity, previous_stock, new_stock, reason, user_id)
         VALUES ($1,$2,'ajuste',$3,$4,$5,'Ajuste por edición de artículo',$6)`,
        [id, req.user.clinic_id, Math.abs(diff), before.current_stock, after.current_stock, req.user.id]
      );
    }
    res.json(decorate(after));
  } catch (err) {
    console.error('[inventory] update error:', err);
    res.status(500).json({ error: 'Error actualizando artículo' });
  }
});

// ── Archive (soft delete) ──
router.post('/:id/archive', authenticate, async (req, res) => {
  if (!canEdit(req)) return res.status(403).json({ error: 'No autorizado' });
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'ID inválido' });
  const r = await query(
    `UPDATE inventory_items SET is_archived = TRUE, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND clinic_id = $2 RETURNING id`,
    [id, req.user.clinic_id]
  );
  if (r.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
  res.json({ success: true });
});

router.post('/:id/restore', authenticate, async (req, res) => {
  if (!canEdit(req)) return res.status(403).json({ error: 'No autorizado' });
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'ID inválido' });
  const r = await query(
    `UPDATE inventory_items SET is_archived = FALSE, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND clinic_id = $2 RETURNING id`,
    [id, req.user.clinic_id]
  );
  if (r.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
  res.json({ success: true });
});

// ── Hard delete ──
router.delete('/:id', authenticate, async (req, res) => {
  if (!canEdit(req)) return res.status(403).json({ error: 'No autorizado' });
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'ID inválido' });

  const existing = await query('SELECT image_url FROM inventory_items WHERE id = $1 AND clinic_id = $2', [id, req.user.clinic_id]);
  if (existing.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });

  await query('DELETE FROM inventory_items WHERE id = $1 AND clinic_id = $2', [id, req.user.clinic_id]);

  const url = existing.rows[0].image_url;
  if (url && url.includes('cloudinary')) {
    const publicId = url.split('/').slice(-2).join('/').split('.')[0];
    await cloudinary.uploader.destroy(`inventory/${id}/${publicId}`).catch(() => {});
  }
  res.json({ success: true });
});

// ── Duplicate ──
router.post('/:id/duplicate', authenticate, async (req, res) => {
  if (!canEdit(req)) return res.status(403).json({ error: 'No autorizado' });
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'ID inválido' });
  const src = await query('SELECT * FROM inventory_items WHERE id = $1 AND clinic_id = $2', [id, req.user.clinic_id]);
  if (src.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
  const o = src.rows[0];
  const r = await query(
    `INSERT INTO inventory_items (
      clinic_id, name, description, image_url, sku, barcode, category, type,
      current_stock, min_stock, max_stock, unit, low_stock_alert,
      purchase_date, expiration_date, expiration_alert_days,
      unit_cost, sale_price, currency, supplier_name, invoice_number, purchase_notes,
      branch, area, exact_location, responsible_user_id,
      is_active, requires_expiration_control, requires_authorization_for_use,
      allow_use_in_appointments, internal_notes, created_by
     ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,0,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31
     ) RETURNING *`,
    [
      req.user.clinic_id, `${o.name} (copia)`, o.description, '', o.sku ? `${o.sku}-COPY` : '', o.barcode, o.category, o.type,
      o.min_stock, o.max_stock, o.unit, o.low_stock_alert,
      o.purchase_date, o.expiration_date, o.expiration_alert_days,
      o.unit_cost, o.sale_price, o.currency, o.supplier_name, o.invoice_number, o.purchase_notes,
      o.branch, o.area, o.exact_location, o.responsible_user_id,
      o.is_active, o.requires_expiration_control, o.requires_authorization_for_use,
      o.allow_use_in_appointments, o.internal_notes, req.user.id
    ]
  );
  res.json(decorate(r.rows[0]));
});

// ── Stock adjust (quick) ──
router.post('/:id/adjust', authenticate, async (req, res) => {
  if (!canEdit(req)) return res.status(403).json({ error: 'No autorizado' });
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'ID inválido' });

  const type = ALLOWED_MOVEMENTS.includes(req.body.type) ? req.body.type : null;
  const qty = Number(req.body.quantity);
  if (!type) return res.status(400).json({ error: 'Tipo de movimiento inválido' });
  if (isNaN(qty) || qty <= 0) return res.status(400).json({ error: 'Cantidad inválida' });

  const existing = await query('SELECT * FROM inventory_items WHERE id = $1 AND clinic_id = $2', [id, req.user.clinic_id]);
  if (existing.rows.length === 0) return res.status(404).json({ error: 'Artículo no encontrado' });

  const item = existing.rows[0];
  const previous = Number(item.current_stock || 0);
  let next = previous;
  if (type === 'entrada') next = previous + qty;
  else if (type === 'salida' || type === 'perdida' || type === 'vencimiento') next = previous - qty;
  else if (type === 'ajuste') next = qty;
  else if (type === 'transferencia') next = previous; // location-only movement

  if (next < 0) next = 0;

  const updated = await query(
    'UPDATE inventory_items SET current_stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND clinic_id = $3 RETURNING *',
    [next, id, req.user.clinic_id]
  );

  // For 'salida' the caller may flag the movement as a sale and capture
  // sale price + cost snapshot so /finanzas can compute profit later.
  const isSale = type === 'salida' && bool(req.body.is_sale, false);
  const salePrice = isSale ? num(req.body.unit_sale_price, Number(item.sale_price || 0)) : null;
  const costAtSale = isSale ? Number(item.unit_cost || 0) : null;

  await query(
    `INSERT INTO inventory_movements
       (inventory_item_id, clinic_id, type, quantity, previous_stock, new_stock,
        reason, note, user_id, is_sale, unit_sale_price, unit_cost_at_sale)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      id, req.user.clinic_id, type, qty, previous, next,
      str(req.body.reason), str(req.body.note), req.user.id,
      isSale, salePrice, costAtSale
    ]
  );

  res.json(decorate(updated.rows[0]));
});

// ── Product sales summary (Finanzas card) ──
// Returns aggregate sale metrics from inventory_movements rows where
// is_sale = TRUE. Profit per row = (unit_sale_price − unit_cost_at_sale) * quantity.
// Doctors only see their own sales; admins see clinic-wide totals.
router.get('/sales/summary', authenticate, async (req, res) => {
  try {
    const clinicId = req.user.clinic_id;
    const isDoctor = req.user.role === 'doctor';
    const userFilter = isDoctor ? ' AND user_id = $2' : '';
    const userFilterAliased = isDoctor ? ' AND m.user_id = $2' : '';
    const baseParams = isDoctor ? [clinicId, req.user.id] : [clinicId];

    const monthAgg = await query(
      `SELECT
         COALESCE(SUM((COALESCE(unit_sale_price,0) - COALESCE(unit_cost_at_sale,0)) * quantity), 0) AS profit,
         COALESCE(SUM(COALESCE(unit_sale_price,0) * quantity), 0) AS revenue,
         COALESCE(SUM(quantity), 0) AS units,
         COUNT(*)::int AS sales_count
       FROM inventory_movements
       WHERE clinic_id = $1
         AND is_sale = TRUE
         AND date_trunc('month', created_at) = date_trunc('month', CURRENT_TIMESTAMP)
         ${userFilter}`,
      baseParams
    );

    const histAgg = await query(
      `SELECT
         COALESCE(SUM((COALESCE(unit_sale_price,0) - COALESCE(unit_cost_at_sale,0)) * quantity), 0) AS profit,
         COALESCE(SUM(COALESCE(unit_sale_price,0) * quantity), 0) AS revenue,
         COALESCE(SUM(quantity), 0) AS units,
         COUNT(*)::int AS sales_count
       FROM inventory_movements
       WHERE clinic_id = $1 AND is_sale = TRUE${userFilter}`,
      baseParams
    );

    const topProducts = await query(
      `SELECT i.id, i.name, i.image_url,
              SUM(m.quantity) AS units,
              SUM((COALESCE(m.unit_sale_price,0) - COALESCE(m.unit_cost_at_sale,0)) * m.quantity) AS profit,
              SUM(COALESCE(m.unit_sale_price,0) * m.quantity) AS revenue
       FROM inventory_movements m
       JOIN inventory_items i ON i.id = m.inventory_item_id
       WHERE m.clinic_id = $1
         AND m.is_sale = TRUE
         AND date_trunc('month', m.created_at) = date_trunc('month', CURRENT_TIMESTAMP)
         ${userFilterAliased}
       GROUP BY i.id, i.name, i.image_url
       ORDER BY profit DESC
       LIMIT 5`,
      baseParams
    );

    res.json({
      month: monthAgg.rows[0],
      historic: histAgg.rows[0],
      top_products: topProducts.rows
    });
  } catch (err) {
    console.error('[inventory] sales summary error:', err);
    res.status(500).json({ error: 'Error calculando ventas' });
  }
});

// ── Product sales list (table in Finanzas) ──
// Doctors only see their own sales; admins see clinic-wide rows.
router.get('/sales/list', authenticate, async (req, res) => {
  try {
    const clinicId = req.user.clinic_id;
    const isDoctor = req.user.role === 'doctor';
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const params = isDoctor ? [clinicId, req.user.id, limit] : [clinicId, limit];
    const userFilter = isDoctor ? ' AND m.user_id = $2' : '';
    const limitParam = isDoctor ? '$3' : '$2';
    const r = await query(
      `SELECT m.id, m.created_at, m.quantity,
              m.unit_sale_price, m.unit_cost_at_sale,
              ((COALESCE(m.unit_sale_price,0) - COALESCE(m.unit_cost_at_sale,0)) * m.quantity) AS profit,
              (COALESCE(m.unit_sale_price,0) * m.quantity) AS revenue,
              m.note, m.reason,
              i.id AS item_id, i.name AS item_name, i.image_url AS item_image,
              i.unit AS item_unit,
              u.name AS user_name
       FROM inventory_movements m
       JOIN inventory_items i ON i.id = m.inventory_item_id
       LEFT JOIN users u ON u.id = m.user_id
       WHERE m.clinic_id = $1 AND m.is_sale = TRUE${userFilter}
       ORDER BY m.created_at DESC
       LIMIT ${limitParam}`,
      params
    );
    res.json(r.rows);
  } catch (err) {
    console.error('[inventory] sales list error:', err);
    res.status(500).json({ error: 'Error listando ventas' });
  }
});

// ── Movements ──
router.get('/:id/movements', authenticate, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'ID inválido' });
  const r = await query(
    `SELECT m.*, u.name AS user_name
     FROM inventory_movements m
     LEFT JOIN users u ON u.id = m.user_id
     WHERE m.inventory_item_id = $1 AND m.clinic_id = $2
     ORDER BY m.created_at DESC`,
    [id, req.user.clinic_id]
  );
  res.json(r.rows);
});

// ── Image upload ──
router.post('/:id/image', authenticate, imageUpload.single('image'), async (req, res) => {
  if (!canEdit(req)) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  const id = parseInt(req.params.id, 10);
  if (!id || !req.file) {
    return res.status(400).json({ error: 'Datos inválidos' });
  }
  const existing = await query('SELECT image_url FROM inventory_items WHERE id = $1 AND clinic_id = $2', [id, req.user.clinic_id]);
  if (existing.rows.length === 0) {
    return res.status(404).json({ error: 'Artículo no encontrado' });
  }

  try {
    const publicId = `inventory/${id}/${Date.now()}-${uuid()}`;
    const result = await uploadToCloudinary(req.file.buffer, publicId);

    const oldUrl = existing.rows[0].image_url;
    if (oldUrl && oldUrl.includes('cloudinary')) {
      const oldPublicId = oldUrl.split('/').slice(-2).join('/').split('.')[0];
      await cloudinary.uploader.destroy(`inventory/${id}/${oldPublicId}`).catch(() => {});
    }

    await query(
      'UPDATE inventory_items SET image_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND clinic_id = $3',
      [result.secure_url, id, req.user.clinic_id]
    );
    res.json({ image_url: result.secure_url });
  } catch (err) {
    console.error('Image upload error:', err);
    res.status(500).json({ error: 'Error al subir imagen' });
  }
});

// ── Standalone image upload (used during item creation, before id exists) ──
router.post('/upload-image', authenticate, imageUpload.single('image'), async (req, res) => {
  if (!canEdit(req)) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  if (!req.file) return res.status(400).json({ error: 'No se recibió imagen' });

  try {
    const publicId = `inventory/temp/${Date.now()}-${uuid()}`;
    const result = await uploadToCloudinary(req.file.buffer, publicId);
    res.json({ image_url: result.secure_url });
  } catch (err) {
    console.error('Image upload error:', err);
    res.status(500).json({ error: 'Error al subir imagen' });
  }
});

router.delete('/:id/image', authenticate, async (req, res) => {
  if (!canEdit(req)) return res.status(403).json({ error: 'No autorizado' });
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'ID inválido' });
  const existing = await query('SELECT image_url FROM inventory_items WHERE id = $1 AND clinic_id = $2', [id, req.user.clinic_id]);
  if (existing.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
  const url = existing.rows[0].image_url;
  await query(
    'UPDATE inventory_items SET image_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND clinic_id = $3',
    ['', id, req.user.clinic_id]
  );
  if (url && url.includes('cloudinary')) {
    const publicId = url.split('/').slice(-2).join('/').split('.')[0];
    await cloudinary.uploader.destroy(`inventory/${id}/${publicId}`).catch(() => {});
  }
  res.json({ success: true });
});

// ── Multer error handler ──
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err?.message?.includes('imágenes')) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;
