/**
 * Parsed representation of a Pix-scheme URI delivered by the HCE service
 * through `Intent.ACTION_VIEW`.
 */
export type ParsedPixUri = {
  /**
   * The arbitrary host the POS terminal put in the NDEF URI record. In
   * practice this is the acquirer's domain (e.g. `cielo.com.br`). Never
   * route on host — accept anything.
   */
  host: string;

  /**
   * The Pix "Copia e Cola" EMV string, URL-decoded. Starts with `000201`.
   * This is the payload to hand off to a Pix BaaS provider for decoding and
   * charge creation.
   */
  qr: string;

  /**
   * Any additional query parameters the POS included (for example the
   * BACEN-reserved `sig` for future signature verification). Passed through
   * untouched; the library does not parse or validate them today.
   */
  params: Record<string, string>;
};

/**
 * Parse a `pix://<host>?qr=<URL-encoded EMV>[&extra]` URI into its parts.
 * Returns `null` when the URI is not a Pix scheme, malformed, or missing
 * the `qr` parameter.
 *
 * The BACEN spec mandates exactly this shape for the URI record embedded in
 * the NDEF payload from the POS; see the BACEN Tap to Pix spec v1.0, § 2.3.
 */
export const parsePixUri = (uri: string): ParsedPixUri | null => {
  if (!uri || !uri.startsWith('pix://')) return null;

  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'pix:') return null;

  const qr = parsed.searchParams.get('qr');
  if (!qr) return null;

  const params: Record<string, string> = {};
  parsed.searchParams.forEach((value, key) => {
    if (key !== 'qr') params[key] = value;
  });

  return {
    host: parsed.hostname,
    qr,
    params,
  };
};
