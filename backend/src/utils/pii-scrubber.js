const patterns = [
  { regex: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: "[REDACTED-SSN]" },
  { regex: /\b\d{3} \d{2} \d{4}\b/g, replacement: "[REDACTED-SSN]" },
  { regex: /\b\d{16}\b/g, replacement: "[REDACTED-CARD]" },
  { regex: /\b\d{4}[- ]\d{4}[- ]\d{4}[- ]\d{4}\b/g, replacement: "[REDACTED-CARD]" },
  {
    regex: /\b(?:\+?\d{1,3}[ -]?)?(?:\(\d{3}\)|\d{3})[ -]?\d{3}[ -]?\d{4}\b/g,
    replacement: "[REDACTED-PHONE]",
  },
  {
    regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    replacement: "[REDACTED-EMAIL]",
  },
];

function scrubPII(input) {
  if (!input || typeof input !== "string") {
    return input;
  }

  let sanitized = input;
  for (const { regex, replacement } of patterns) {
    sanitized = sanitized.replace(regex, replacement);
  }

  return sanitized;
}

module.exports = { scrubPII };
