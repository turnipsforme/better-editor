export const toHeadingLine = (line: string, level: number): string => {
  const indent = line.match(/^( {0,3})/)?.[1] ?? "";
  const marker = line.slice(indent.length).match(/^#{1,6}(?:[ \t]+|$)/);
  const content = marker
    ? line.slice(indent.length + marker[0].length)
    : line.slice(indent.length);
  const heading = "#".repeat(level);
  return content ? `${indent}${heading} ${content}` : `${indent}${heading}`;
};
