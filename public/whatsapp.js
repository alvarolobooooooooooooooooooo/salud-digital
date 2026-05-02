// ── whatsapp.js — Helper utilities for manual WhatsApp reminders ──
// No external API. Just opens wa.me links with a prefilled message.

(function(global) {
  'use strict';

  /**
   * Normalize a phone number to international format without + or special chars.
   * Returns only digits. Example: "+504 8888-8888" -> "50488888888"
   * @param {string} raw
   * @returns {string} digits only, or empty string if invalid
   */
  function normalizePhone(raw) {
    if (!raw || typeof raw !== 'string') return '';
    return raw.replace(/\D/g, '');
  }

  /**
   * Validate a normalized phone number (digits only, reasonable length).
   * @param {string} phone
   * @returns {boolean}
   */
  function isValidPhone(phone) {
    const n = normalizePhone(phone);
    return /^\d{8,15}$/.test(n);
  }

  /**
   * Build a wa.me URL with the message URL-encoded.
   * For Honduras: if 8 digits, prepend 504. If already starts with 504, use as-is.
   * @param {string} phone — normalized phone (digits only)
   * @param {string} message
   * @returns {string} URL or empty string if invalid
   */
  function buildWaLink(phone, message) {
    const n = normalizePhone(phone);
    if (!isValidPhone(n)) return '';
    // Honduras: 8 digits = local format, prepend 504 for wa.me
    const intlPhone = n.length === 8 ? '504' + n : n;
    const text = encodeURIComponent(message || '');
    return `https://wa.me/${intlPhone}?text=${text}`;
  }

  /**
   * Format a date string (ISO or yyyy-mm-dd HH:MM) into Spanish friendly date+time.
   * @param {string} isoDate
   * @returns {{date: string, time: string}}
   */
  function formatAppointmentDateTime(isoDate) {
    if (!isoDate) return { date: '', time: '' };
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return { date: '', time: '' };
    const date = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true });
    return { date, time };
  }

  /**
   * Replace {{placeholders}} in a template with values from data.
   * @param {string} template
   * @param {object} data
   * @returns {string}
   */
  function renderTemplate(template, data) {
    if (!template) return '';
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, key) => {
      return data[key] != null ? String(data[key]) : '';
    });
  }

  /**
   * Build the full reminder message for an appointment.
   * @param {object} ctx — { template, patientName, clinicName, doctorName, scheduledAt }
   * @returns {string}
   */
  function buildReminderMessage(ctx) {
    const { date, time } = formatAppointmentDateTime(ctx.scheduledAt);
    return renderTemplate(ctx.template || '', {
      patientName: ctx.patientName || '',
      clinicName: ctx.clinicName || '',
      doctorName: ctx.doctorName || '',
      appointmentDate: date,
      appointmentTime: time
    });
  }

  /**
   * Determine the reminder visual state for an appointment.
   * Returns one of: 'whatsapp_disabled', 'no_whatsapp_number', 'manual_sent', 'pending'.
   * @param {object} args — { whatsappEnabled, patientWhatsapp, reminderStatus }
   * @returns {string}
   */
  function getReminderState({ whatsappEnabled, patientWhatsapp, reminderStatus }) {
    if (!whatsappEnabled) return 'whatsapp_disabled';
    const normalized = normalizePhone(patientWhatsapp);
    if (!isValidPhone(normalized)) return 'no_whatsapp_number';
    if (reminderStatus === 'manual_sent') return 'manual_sent';
    return 'pending';
  }

  /**
   * Open WhatsApp with pre-filled message in a new tab that closes itself.
   * @param {string} phone
   * @param {string} message
   * @returns {boolean} true if opened, false if invalid number
   */
  function openWhatsApp(phone, message) {
    const url = buildWaLink(phone, message);
    if (!url) return false;
    const win = window.open(url, '_blank');
    if (win) setTimeout(() => win.close(), 1500);
    return true;
  }

  /**
   * Copy a message to clipboard. Returns a promise that resolves true on success.
   * @param {string} text
   * @returns {Promise<boolean>}
   */
  async function copyMessage(text) {
    try {
      await navigator.clipboard.writeText(text || '');
      return true;
    } catch (e) {
      return false;
    }
  }

  global.WhatsApp = {
    normalizePhone,
    isValidPhone,
    buildWaLink,
    formatAppointmentDateTime,
    renderTemplate,
    buildReminderMessage,
    getReminderState,
    openWhatsApp,
    copyMessage
  };
})(window);
