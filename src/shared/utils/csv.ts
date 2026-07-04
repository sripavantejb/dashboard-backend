export function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]).map((h) => h.replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map((line) => {
    const values = parseLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header] = (values[i] || '').replace(/^"|"$/g, '');
    });
    return row;
  });

  return { headers, rows };
}

export function parseBulkText(text: string): Record<string, string>[] {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split('\n');
      const row: Record<string, string> = {};
      for (const line of lines) {
        const [key, ...rest] = line.split(':');
        if (key && rest.length) row[key.trim().toLowerCase()] = rest.join(':').trim();
      }
      if (!row.firstname && !row.name) {
        row.firstname = lines[0];
      }
      return row;
    });
}

export const LEAD_FIELD_MAP: Record<string, string> = {
  first_name: 'firstName',
  firstname: 'firstName',
  name: 'firstName',
  last_name: 'lastName',
  lastname: 'lastName',
  email: 'email',
  phone: 'phone',
  mobile: 'phone',
  company: 'company',
  organization: 'company',
  title: 'title',
  website: 'website',
  city: 'city',
  state: 'state',
  country: 'country',
  source: 'source',
  notes: 'notes',
};
