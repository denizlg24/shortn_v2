const counters = new Map<string, number>();
const gauges = new Map<string, () => number>();

export const metrics = {
  inc(name: string, by = 1) {
    counters.set(name, (counters.get(name) ?? 0) + by);
  },
  gauge(name: string, read: () => number) {
    gauges.set(name, read);
  },
  render(): string {
    const lines: string[] = [];
    for (const [name, value] of counters)
      lines.push(
        `# TYPE shortn_redirect_${name} counter`,
        `shortn_redirect_${name} ${value}`,
      );
    for (const [name, read] of gauges)
      lines.push(
        `# TYPE shortn_redirect_${name} gauge`,
        `shortn_redirect_${name} ${read()}`,
      );
    return `${lines.join("\n")}\n`;
  },
};
