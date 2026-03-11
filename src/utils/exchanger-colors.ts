/**
 * Generates a deterministic color for an exchanger name.
 */
const getHash = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
};

export const getRowStyleForExchanger = (exchanger?: string): string => {
    if (!exchanger || exchanger === '-') return '#ffffff';
    const h = getHash(exchanger) % 360;
    return `hsl(${h}, 60%, 95%)`;
};

export const getChipStyleForExchanger = (exchanger?: string): { background: string; color: string } => {
    if (!exchanger || exchanger === '-') return { background: '#f1f5f9', color: '#64748b' };
    const h = getHash(exchanger) % 360;
    return {
        background: `hsl(${h}, 70%, 85%)`,
        color: `hsl(${h}, 80%, 25%)`
    };
};
