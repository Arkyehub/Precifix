export interface ProductForCalculation {
  gallonPrice: number;
  gallonVolume: number; // em ml
  dilutionRatio: number; // ex: 10 para 1:10
  usagePerVehicle: number; // em ml
  type: 'diluted' | 'ready-to-use';
  containerSize?: number; // Adicionado containerSize
}

export const calculateProductCost = (product: ProductForCalculation): number => {
  if (product.type === 'ready-to-use') {
    const costPerMl = product.gallonPrice / product.gallonVolume;
    return costPerMl * product.usagePerVehicle;
  } else {
    const costPerMlConcentrated = product.gallonPrice / product.gallonVolume;
    // Nova lógica de diluição: 1 parte de produto em X partes da solução total
    // O custo do ml concentrado é dividido pela proporção de diluição para obter o custo por ml da solução final
    const costPerMlDilutedSolution = costPerMlConcentrated / product.dilutionRatio;
    return costPerMlDilutedSolution * product.usagePerVehicle;
  }
};

export const calculateProductCostPerLiter = (product: ProductForCalculation): number => {
  if (product.type === 'ready-to-use') {
    const costPerMl = product.gallonPrice / product.gallonVolume;
    return costPerMl * 1000; // Custo por litro
  } else {
    const costPerMlConcentrated = product.gallonPrice / product.gallonVolume;
    // Nova lógica de diluição: 1 parte de produto em X partes da solução total
    const costPerMlDilutedSolution = costPerMlConcentrated / product.dilutionRatio;
    return costPerMlDilutedSolution * 1000; // Custo por litro da solução diluída
  }
};

export const calculateProductCostPerContainer = (product: ProductForCalculation): number => {
  if (product.type === 'diluted' && product.dilutionRatio > 0 && product.containerSize && product.containerSize > 0) {
    const costPerMlConcentrated = product.gallonPrice / product.gallonVolume;
    const costPerMlDilutedSolution = costPerMlConcentrated / product.dilutionRatio;
    return costPerMlDilutedSolution * product.containerSize;
  }
  return 0; // Retorna 0 se não for diluído ou se os dados forem inválidos
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

export const timeToMinutes = (time: string): number => {
  if (!time) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};