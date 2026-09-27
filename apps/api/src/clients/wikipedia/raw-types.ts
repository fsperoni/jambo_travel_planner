// The shape of a successful response from Wikipedia's REST API
// (/api/rest_v1/page/summary/{title}) — confirmed against real responses
// (a standard article, a disambiguation page, and a title with special
// characters), not written from documentation alone. Only the fields this
// app actually reads are declared.
export interface WikipediaSummaryResponse {
  title: string;
  /** "standard" for a real article; "disambiguation" for a page that just
   *  lists other pages sharing the same title — both confirmed directly
   *  against the real API. */
  type: string;
  /** A few sentences of plain-text summary. Absent on some pages (e.g. a
   *  disambiguation page has no meaningful extract). */
  extract?: string;
  content_urls?: {
    desktop?: {
      page?: string;
    };
  };
}
