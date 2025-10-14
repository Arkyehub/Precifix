export interface ProductForCalculation {
  gallonPrice: number;
  gallonVolume: number; // em ml
  dilutionRatio: number; // ex: 10 para 1:10
  usagePerVehicle: number; // em ml
  type: 'diluted' | 'ready-to-use';
}

export const calculateProductCost = (product: ProductForCalculation): number => {
  if (product.type === 'ready-to-use') {
    const costPerMl = product.gallonPrice / product.gallonVolume;
    return costPerMl * product.usagePerVehicle;
  } else {
    const costPerMlConcentrated = product.gallonPrice / product.gallonVolume;
    const costPerMlDilutedSolution = costPerMlConcentrated / (1 + product.dilutionRatio);
    return costPerMlDilutedSolution * product.usagePerVehicle;
  }
};

export const formatDilutionRatio = (ratio: number): string => {
  return ratio > 0 ? `1:${ratio}` : 'N/A';
};

export const formatMinutesToHHMM = (totalMinutes: number): string => {
  if (isNaN(totalMinutes) || totalMinutes < 0) return "00:00";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const parseHHMMToMinutes = (hhmm: string): number => {
  const parts = hhmm.split(':');
  if (parts.length !== 2) return 0;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || minutes < 0 || minutes >= 60) return 0;
  return hours * 60 + minutes;
};