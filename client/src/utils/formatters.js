/**
 * Formats a date string in "YYYY-MM" format to "MMM YYYY" (e.g., "2024-01" -> "Jan 2024")
 * @param {string} dateStr - The date string from the database (usually YYYY-MM)
 * @returns {string} - The formatted date string
 */
export const formatDate = (dateStr) => {
    if (!dateStr) return "";
    if (/^\d{4}-\d{2}$/.test(dateStr.trim())) {
        const [year, month] = dateStr.split("-");
        const date = new Date(parseInt(year), parseInt(month) - 1);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleDateString("en-US", { year: "numeric", month: "short" });
    }
    return dateStr;
};
