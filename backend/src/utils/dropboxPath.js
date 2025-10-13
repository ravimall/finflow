const LEGACY_PATH_PREFIXES = [
  '/Apps/FinFlow/finflow/',
  '/apps/finflow/finflow/',
  '/finflow/',
];

function sanitizeSegment(value, fallback = 'unknown') {
  const normalized = (value || fallback)
    .toString()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .trim();

  const collapsed = normalized.replace(/\s+/g, '_');
  return collapsed || fallback;
}

function buildCustomerFolderPath(agentName, customerName, customerCode) {
  const safeCustomer = sanitizeSegment(customerName, 'customer').toLowerCase();
  const safeCode = sanitizeSegment(customerCode, 'customer');
  return `/FinFlow/customers/${safeCode}-${safeCustomer}`;
}

function isLegacyDropboxPath(path) {
  if (!path) {
    return false;
  }

  return LEGACY_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

module.exports = {
  LEGACY_PATH_PREFIXES,
  sanitizeSegment,
  buildCustomerFolderPath,
  isLegacyDropboxPath,
};
