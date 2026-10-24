import { useEffect, useState } from "react";

// The server renders in UTC and the browser in the person's own timezone, so labels like "Yesterday" or "due Fri"
// are drawn only once the page is in the browser. Both first renders show none and agree; then the browser's time.
export function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  return now;
}
