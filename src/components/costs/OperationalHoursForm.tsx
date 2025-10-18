import React from 'react';
import { Button } from "@/components/ui/button";
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Clock } from 'lucide-react';
import { OperationalHours, daysOfWeek } from '@/types/costs';

interface OperationalHoursFormProps {
  operationalHours: Omit<OperationalHours, 'id' | 'user_id' | 'created_at'>;
  selectedDays: { [key: string]: boolean };
  onDayToggle: (dayKey: string) => void;
  onHourChange: (day: string, type: 'start' | 'end', value: string) => void;
  onSaveHours: () => void;
  isSaving: boolean;
}

export const OperationalHoursForm = ({
  operationalHours,
  selectedDays,
  onDayToggle,
  onHourChange,
  onSaveHours,
  isSaving,
}: OperationalHoursFormProps) => {
  return (
    <div className="space-y-4 pt-6 border-t border-border/50">
      <div className="flex items-center gap-2">
        <Clock className="h-5 w-5 text-primary" />
        <h3 className="text-xl font-semibold text-foreground">Horas Trabalhadas</h3>
      </div>
      {/* Removido o div com estilo de card, mantendo apenas o parágrafo */}
      <p className="text-sm font-medium text-muted-foreground">
        Defina seus dias e horários de funcionamento.
      </p>
      <div className="space-y-3">
        {daysOfWeek.map(day => (
          <div key={day.key} className="flex items-center gap-2">
            <Checkbox 
              id={day.key} 
              checked={selectedDays[day.key]} 
              onCheckedChange={() => onDayToggle(day.key)} 
            />
            <Label htmlFor={day.key} className="w-12">{day.label}:</Label>
            <Input
              type="time"
              value={operationalHours[`${day.key}_start` as keyof typeof operationalHours]}
              onChange={(e) => onHourChange(day.key, 'start', e.target.value)}
              className="flex-1 bg-background"
              disabled={!selectedDays[day.key]}
            />
            <span className="text-muted-foreground">-</span>
            <Input
              type="time"
              value={operationalHours[`${day.key}_end` as keyof typeof operationalHours]}
              onChange={(e) => onHourChange(day.key, 'end', e.target.value)}
              className="flex-1 bg-background"
              disabled={!selectedDays[day.key]}
            />
          </div>
        ))}
      </div>
      <Button 
        onClick={onSaveHours}
        className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80"
        disabled={isSaving}
      >
        {isSaving ? "Salvando..." : "Salvar Horários"}
      </Button>
    </div>
  );
};

export default OperationalHoursForm;