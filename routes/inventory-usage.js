const express = require('express');
const router = express.Router();
const { query, pool } = require('../db');
const { authenticate } = require('../middleware/auth');

// ── Helpers ──
function canEdit(req) {
  return ['clinic_admin', 'doctor', 'super_admin'].includes(req.user.role);
}

function decorateUsage(row) {
  if (!row) return row;
  // Reproject snake_case columns into a richer object that includes computed fields the UI may need.
  return {
    ...row,
    quantity_used: Number(row.quantity_used),
    unit_cost: Number(row.unit_cost),
    total_cost: Number(row.total_cost),
    stock_before: row.stock_before == null ? null : Number(row.stock_before),
    stock_after: row.stock_after == null ? null : Number(row.stock_after),
  };
}

// ── List usage for a consultation ──
// GET /api/inventory-usage?consultation_id=:id
router.get('/', authenticate, async (req, res) => {
  const consultationId = parseInt(req.query.consultation_id, 10);
  if (!consultationId) return res.status(400).json({ error: 'consultation_id requerido' });

  // Verify consultation belongs to clinic
  const consult = await query(
    'SELECT id FROM consultations WHERE id = $1 AND clinic_id = $2',
    [consultationId, req.user.clinic_id]
  );
  if (consult.rows.length === 0) return res.status(404).json({ error: 'Consulta no encontrada' });

  const r = await query(
    `SELECT u.*,
            i.name AS item_name, i.image_url AS item_image_url, i.category AS item_category,
            i.type AS item_type, i.area AS item_area, i.exact_location AS item_location,
            i.expiration_date AS item_expiration_date, i.current_stock AS item_current_stock,
            i.min_stock AS item_min_stock, i.is_archived AS item_is_archived,
            i.sale_price AS item_sale_price,
            usr.name AS used_by_name
     FROM consultation_inventory_usage u
     LEFT JOIN inventory_items i ON i.id = u.inventory_item_id
     LEFT JOIN users usr ON usr.id = u.used_by_user_id
     WHERE u.consultation_id = $1 AND u.clinic_id = $2
     ORDER BY u.created_at ASC`,
    [consultationId, req.user.clinic_id]
  );
  res.json(r.rows.map(decorateUsage));
});

// ── Create a usage (deducts stock + records 'salida' movement) ──
// POST /api/inventory-usage
// body: { consultation_id, inventory_item_id, quantity_used, notes?, consultation_type? }
router.post('/', authenticate, async (req, res) => {
  if (!canEdit(req)) return res.status(403).json({ error: 'No autorizado' });

  const consultationId = parseInt(req.body.consultation_id, 10);
  const itemId = parseInt(req.body.inventory_item_id, 10);
  const qty = Number(req.body.quantity_used);
  const notes = (req.body.notes || '').toString();
  const consultationType = (req.body.consultation_type || 'general').toString();

  if (!consultationId || !itemId) return res.status(400).json({ error: 'Datos incompletos' });
  if (isNaN(qty) || qty <= 0) return res.status(400).json({ error: 'La cantidad debe ser mayor a 0' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the consultation row to ensure it belongs to this clinic
    const consult = await client.query(
      'SELECT id, patient_id FROM consultations WHERE id = $1 AND clinic_id = $2 FOR UPDATE',
      [consultationId, req.user.clinic_id]
    );
    if (consult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Consulta no encontrada' });
    }
    const patientId = consult.rows[0].patient_id;

    // Lock the inventory item row to safely deduct
    const itemRes = await client.query(
      'SELECT * FROM inventory_items WHERE id = $1 AND clinic_id = $2 FOR UPDATE',
      [itemId, req.user.clinic_id]
    );
    if (itemRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Artículo no encontrado' });
    }
    const item = itemRes.rows[0];
    if (item.is_archived) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Este artículo está archivado y no puede usarse' });
    }
    if (item.is_active === false) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Este artículo está inactivo' });
    }

    const stockBefore = Number(item.current_stock || 0);
    const stockAfter = stockBefore - qty;

    // Soft-warn-only: we DO allow negative stock if admin sets it intentionally? For safety,
    // disallow going negative unless the caller explicitly opts in via req.body.allow_negative.
    if (stockAfter < 0 && req.body.allow_negative !== true) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Stock insuficiente. Disponible: ${stockBefore} ${item.unit || ''}, solicitado: ${qty}`
      });
    }

    const unitCost = Number(item.unit_cost || 0);
    const unitSalePrice = Number(item.sale_price || 0);
    const totalCost = unitCost * qty;
    const isSale = unitSalePrice > 0;

    // Insert the usage row (already marked as applied since we deduct here)
    const ins = await client.query(
      `INSERT INTO consultation_inventory_usage
        (clinic_id, consultation_id, consultation_type, patient_id, inventory_item_id,
         quantity_used, unit, unit_cost, total_cost, stock_before, stock_after,
         notes, stock_applied, used_by_user_id, used_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,TRUE,$13,CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        req.user.clinic_id, consultationId, consultationType, patientId, itemId,
        qty, item.unit || '', unitCost, totalCost, stockBefore, stockAfter,
        notes, req.user.id
      ]
    );

    // Update inventory stock
    await client.query(
      'UPDATE inventory_items SET current_stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [stockAfter, itemId]
    );

    // Record movement — when the product has a sale_price > 0 we treat the
    // consultation use as a sale so it surfaces in /finanzas product cards.
    await client.query(
      `INSERT INTO inventory_movements
        (inventory_item_id, clinic_id, type, quantity, previous_stock, new_stock,
         reason, note, user_id, is_sale, unit_sale_price, unit_cost_at_sale)
       VALUES ($1,$2,'salida',$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        itemId, req.user.clinic_id, qty, stockBefore, stockAfter,
        `Usado en consulta #${consultationId}`,
        notes || `Consulta ${consultationType}`,
        req.user.id,
        isSale, isSale ? unitSalePrice : null, isSale ? unitCost : null
      ]
    );

    await client.query('COMMIT');

    // Re-fetch with joined fields for the response
    const final = await query(
      `SELECT u.*,
              i.name AS item_name, i.image_url AS item_image_url, i.category AS item_category,
              i.type AS item_type, i.area AS item_area, i.exact_location AS item_location,
              i.expiration_date AS item_expiration_date, i.current_stock AS item_current_stock,
              i.min_stock AS item_min_stock,
              i.sale_price AS item_sale_price,
              usr.name AS used_by_name
       FROM consultation_inventory_usage u
       LEFT JOIN inventory_items i ON i.id = u.inventory_item_id
       LEFT JOIN users usr ON usr.id = u.used_by_user_id
       WHERE u.id = $1`,
      [ins.rows[0].id]
    );
    res.json(decorateUsage(final.rows[0]));
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('[inventory-usage] create error:', err);
    res.status(500).json({ error: 'Error registrando uso de inventario' });
  } finally {
    client.release();
  }
});

// ── Bulk create (used after consultation save to commit pending usages) ──
// POST /api/inventory-usage/bulk
// body: { consultation_id, consultation_type, items: [{ inventory_item_id, quantity_used, notes }] }
router.post('/bulk', authenticate, async (req, res) => {
  if (!canEdit(req)) return res.status(403).json({ error: 'No autorizado' });
  const consultationId = parseInt(req.body.consultation_id, 10);
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!consultationId || items.length === 0) {
    return res.json({ created: [], errors: [] });
  }

  const created = [];
  const errors = [];
  for (const it of items) {
    try {
      // Reuse the single-create path via internal function-style invocation.
      // We post sequentially to keep stock consistent (each one recomputes stock_before).
      const fakeReq = { user: req.user, body: { ...it, consultation_id: consultationId, consultation_type: req.body.consultation_type } };
      // Inline the create logic via a recursive HTTP-style call would be expensive; instead duplicate the core.
      const itemId = parseInt(it.inventory_item_id, 10);
      const qty = Number(it.quantity_used);
      if (!itemId || isNaN(qty) || qty <= 0) {
        errors.push({ item: it, error: 'Datos inválidos' });
        continue;
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const consult = await client.query(
          'SELECT id, patient_id FROM consultations WHERE id = $1 AND clinic_id = $2 FOR UPDATE',
          [consultationId, req.user.clinic_id]
        );
        if (consult.rows.length === 0) {
          await client.query('ROLLBACK');
          errors.push({ item: it, error: 'Consulta no encontrada' });
          continue;
        }
        const patientId = consult.rows[0].patient_id;
        const itemRes = await client.query(
          'SELECT * FROM inventory_items WHERE id = $1 AND clinic_id = $2 FOR UPDATE',
          [itemId, req.user.clinic_id]
        );
        if (itemRes.rows.length === 0) {
          await client.query('ROLLBACK');
          errors.push({ item: it, error: 'Artículo no encontrado' });
          continue;
        }
        const inv = itemRes.rows[0];
        if (inv.is_archived) {
          await client.query('ROLLBACK');
          errors.push({ item: it, error: `${inv.name}: archivado` });
          continue;
        }
        const stockBefore = Number(inv.current_stock || 0);
        const stockAfter = stockBefore - qty;
        if (stockAfter < 0 && it.allow_negative !== true) {
          await client.query('ROLLBACK');
          errors.push({ item: it, error: `${inv.name}: stock insuficiente (${stockBefore})` });
          continue;
        }
        const unitCost = Number(inv.unit_cost || 0);
        const unitSalePrice = Number(inv.sale_price || 0);
        const totalCost = unitCost * qty;
        const isSale = unitSalePrice > 0;
        const ins = await client.query(
          `INSERT INTO consultation_inventory_usage
            (clinic_id, consultation_id, consultation_type, patient_id, inventory_item_id,
             quantity_used, unit, unit_cost, total_cost, stock_before, stock_after,
             notes, stock_applied, used_by_user_id, used_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,TRUE,$13,CURRENT_TIMESTAMP)
           RETURNING id`,
          [
            req.user.clinic_id, consultationId, req.body.consultation_type || 'general',
            patientId, itemId, qty, inv.unit || '', unitCost, totalCost,
            stockBefore, stockAfter, (it.notes || ''), req.user.id
          ]
        );
        await client.query(
          'UPDATE inventory_items SET current_stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [stockAfter, itemId]
        );
        await client.query(
          `INSERT INTO inventory_movements
            (inventory_item_id, clinic_id, type, quantity, previous_stock, new_stock,
             reason, note, user_id, is_sale, unit_sale_price, unit_cost_at_sale)
           VALUES ($1,$2,'salida',$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            itemId, req.user.clinic_id, qty, stockBefore, stockAfter,
            `Usado en consulta #${consultationId}`,
            (it.notes || ''), req.user.id,
            isSale, isSale ? unitSalePrice : null, isSale ? unitCost : null
          ]
        );
        await client.query('COMMIT');
        created.push({ id: ins.rows[0].id, inventory_item_id: itemId });
      } catch (txErr) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        errors.push({ item: it, error: txErr.message || 'Error transaccional' });
      } finally {
        client.release();
      }
    } catch (e) {
      errors.push({ item: it, error: e.message });
    }
  }
  res.json({ created, errors });
});

// ── Update (changes quantity_used or notes; adjusts stock by the diff) ──
router.put('/:id', authenticate, async (req, res) => {
  if (!canEdit(req)) return res.status(403).json({ error: 'No autorizado' });
  const usageId = parseInt(req.params.id, 10);
  if (!usageId) return res.status(400).json({ error: 'ID inválido' });

  const newQty = Number(req.body.quantity_used);
  const newNotes = req.body.notes != null ? String(req.body.notes) : undefined;

  if (req.body.quantity_used !== undefined && (isNaN(newQty) || newQty <= 0)) {
    return res.status(400).json({ error: 'La cantidad debe ser mayor a 0' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cur = await client.query(
      'SELECT * FROM consultation_inventory_usage WHERE id = $1 AND clinic_id = $2 FOR UPDATE',
      [usageId, req.user.clinic_id]
    );
    if (cur.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Uso no encontrado' });
    }
    const usage = cur.rows[0];
    const itemRes = await client.query(
      'SELECT * FROM inventory_items WHERE id = $1 AND clinic_id = $2 FOR UPDATE',
      [usage.inventory_item_id, req.user.clinic_id]
    );
    if (itemRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Artículo no encontrado' });
    }
    const item = itemRes.rows[0];

    let finalQty = Number(usage.quantity_used);
    let finalNotes = usage.notes;
    let stockBefore = Number(item.current_stock || 0);
    let stockAfter = stockBefore;

    if (req.body.quantity_used !== undefined && newQty !== finalQty) {
      const diff = newQty - finalQty; // positive = need to deduct more, negative = return stock
      stockAfter = stockBefore - diff;
      if (stockAfter < 0 && req.body.allow_negative !== true) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Stock insuficiente para ajustar. Disponible: ${stockBefore}` });
      }
      await client.query(
        'UPDATE inventory_items SET current_stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [stockAfter, item.id]
      );
      const movType = diff > 0 ? 'salida' : 'entrada';
      await client.query(
        `INSERT INTO inventory_movements
          (inventory_item_id, clinic_id, type, quantity, previous_stock, new_stock, reason, note, user_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          item.id, req.user.clinic_id, movType, Math.abs(diff), stockBefore, stockAfter,
          `Ajuste en consulta #${usage.consultation_id}`,
          `Cantidad ${finalQty} → ${newQty}`,
          req.user.id
        ]
      );
      // Keep the original sale row in inventory_movements in sync so Finanzas
      // totals reflect the edit (without polluting history with refund movements).
      await client.query(
        `UPDATE inventory_movements
            SET quantity = $1
          WHERE clinic_id = $2
            AND inventory_item_id = $3
            AND type = 'salida'
            AND is_sale = TRUE
            AND reason = $4`,
        [newQty, req.user.clinic_id, item.id, `Usado en consulta #${usage.consultation_id}`]
      );
      finalQty = newQty;
    }
    if (newNotes !== undefined) finalNotes = newNotes;

    const unitCost = Number(usage.unit_cost || item.unit_cost || 0);
    const totalCost = unitCost * finalQty;

    const upd = await client.query(
      `UPDATE consultation_inventory_usage
       SET quantity_used = $1, total_cost = $2, notes = $3, stock_after = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 RETURNING *`,
      [finalQty, totalCost, finalNotes, stockAfter, usageId]
    );

    await client.query('COMMIT');
    res.json(decorateUsage(upd.rows[0]));
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('[inventory-usage] update error:', err);
    res.status(500).json({ error: 'Error actualizando uso' });
  } finally {
    client.release();
  }
});

// ── Delete (returns stock + creates reverse movement) ──
router.delete('/:id', authenticate, async (req, res) => {
  if (!canEdit(req)) return res.status(403).json({ error: 'No autorizado' });
  const usageId = parseInt(req.params.id, 10);
  if (!usageId) return res.status(400).json({ error: 'ID inválido' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cur = await client.query(
      'SELECT * FROM consultation_inventory_usage WHERE id = $1 AND clinic_id = $2 FOR UPDATE',
      [usageId, req.user.clinic_id]
    );
    if (cur.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Uso no encontrado' });
    }
    const usage = cur.rows[0];

    if (usage.stock_applied) {
      const itemRes = await client.query(
        'SELECT * FROM inventory_items WHERE id = $1 AND clinic_id = $2 FOR UPDATE',
        [usage.inventory_item_id, req.user.clinic_id]
      );
      if (itemRes.rows.length > 0) {
        const item = itemRes.rows[0];
        const stockBefore = Number(item.current_stock || 0);
        const qty = Number(usage.quantity_used);
        const stockAfter = stockBefore + qty;
        await client.query(
          'UPDATE inventory_items SET current_stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [stockAfter, item.id]
        );
        await client.query(
          `INSERT INTO inventory_movements
            (inventory_item_id, clinic_id, type, quantity, previous_stock, new_stock, reason, note, user_id)
           VALUES ($1,$2,'entrada',$3,$4,$5,$6,$7,$8)`,
          [
            item.id, req.user.clinic_id, qty, stockBefore, stockAfter,
            `Reverso de uso en consulta #${usage.consultation_id}`,
            'Devolución por eliminación de uso',
            req.user.id
          ]
        );
        // Cancel the original sale row so Finanzas no longer counts it.
        await client.query(
          `DELETE FROM inventory_movements
            WHERE clinic_id = $1
              AND inventory_item_id = $2
              AND type = 'salida'
              AND is_sale = TRUE
              AND reason = $3`,
          [req.user.clinic_id, item.id, `Usado en consulta #${usage.consultation_id}`]
        );
      }
    }

    await client.query('DELETE FROM consultation_inventory_usage WHERE id = $1', [usageId]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('[inventory-usage] delete error:', err);
    res.status(500).json({ error: 'Error eliminando uso' });
  } finally {
    client.release();
  }
});

module.exports = router;
