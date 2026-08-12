type ConsoleTablePrimitive =
    | string
    | number
    | boolean
    | null
    | undefined;

type ConsoleTableRow = Record<string, unknown>;

type ConsoleTableInput =
    | ConsoleTablePrimitive[]
    | ConsoleTableRow[]
    | Record<string, unknown>;

function escapeHtml(value: unknown): string {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function consoleTable(
    data: ConsoleTableInput,
    columns?: string[]
): void {
    const rows: ConsoleTableRow[] = [];

    if (Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
            const value = data[i];

            if (value !== null && typeof value === "object") {
                rows.push(
                    Object.assign(
                        { "(index)": i },
                        value as ConsoleTableRow
                    )
                );
            } else {
                rows.push({
                    "(index)": i,
                    Values: value
                });
            }
        }
    } else if (data !== null && typeof data === "object") {
        const keys = Object.keys(data);

        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const value = data[key];

            if (value !== null && typeof value === "object") {
                rows.push(
                    Object.assign(
                        { "(index)": key },
                        value as ConsoleTableRow
                    )
                );
            } else {
                rows.push({
                    "(index)": key,
                    Values: value
                });
            }
        }
    }

    let columnNames: string[];

    if (columns) {
        columnNames = columns.slice();
    } else {
        columnNames = [];

        for (let i = 0; i < rows.length; i++) {
            const rowKeys = Object.keys(rows[i]);

            for (let j = 0; j < rowKeys.length; j++) {
                const key = rowKeys[j];

                if (columnNames.indexOf(key) === -1) {
                    columnNames.push(key);
                }
            }
        }
    }

    let html =
        '<table style="' +
        "border-collapse:collapse;" +
        "font-family:monospace;" +
        "font-size:12px;" +
        '">';

    html += "<thead><tr>";

    for (let i = 0; i < columnNames.length; i++) {
        html +=
            '<th style="' +
            "border:1px solid #555;" +
            "padding:3px 6px;" +
            "text-align:left;" +
            '">' +
            escapeHtml(columnNames[i]) +
            "</th>";
    }

    html += "</tr></thead><tbody>";

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        html += "<tr>";

        for (let j = 0; j < columnNames.length; j++) {
            const column = columnNames[j];
            const value = row[column];

            html +=
                '<td style="' +
                "border:1px solid #444;" +
                "padding:3px 6px;" +
                '">' +
                escapeHtml(value == null ? "" : value) +
                "</td>";
        }

        html += "</tr>";
    }

    html += "</tbody></table>";

    console.log(html);
}