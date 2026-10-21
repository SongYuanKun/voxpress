export type TrackingCandidate = {
  tracking_number: string;
  confidence: number;
  evidence: string;
};

function pickTrackingNumbers(text: string) {
  const normalized = text.toUpperCase().replace(/[O]/g, '0').replace(/[IL]/g, '1');
  const candidates = normalized.match(/[A-Z0-9]{8,32}/g) || [];
  const seen = new Set<string>();
  return candidates
    .map((value) => ({
      value,
      score: (/[0-9]/.test(value) ? 2 : 0) + Math.min(value.length, 20) + (/[A-Z]/.test(value) ? 1 : 0)
    }))
    .filter((item) => /\d{6,}/.test(item.value))
    .sort((a, b) => b.score - a.score)
    .filter((item) => {
      if (seen.has(item.value)) return false;
      seen.add(item.value);
      return true;
    })
    .slice(0, 50)
    .map((item) => item.value);
}

export function extractTrackingCandidates(snippets: string[]): { candidates: TrackingCandidate[]; evidence: string } {
  const fullEvidence = snippets.join('\n');
  const evidence = fullEvidence.replace(/\s+/g, ' ').slice(0, 300);
  const trackingNumbers = pickTrackingNumbers(fullEvidence);
  return {
    candidates: trackingNumbers.map((trackingNumber) => ({
      tracking_number: trackingNumber,
      confidence: 0.72,
      evidence: evidence.slice(0, 160)
    })),
    evidence
  };
}

export function recordsFromCandidates(candidates: TrackingCandidate[], rawText = '') {
  return candidates.map((candidate, index) => ({
    tracking_number: candidate.tracking_number,
    raw_text: index === 0 ? rawText : '',
    items: [] as []
  }));
}
