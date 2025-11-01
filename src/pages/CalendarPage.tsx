import React from 'react';
import { MonthlyCalendarView } from '@/components/agenda/MonthlyCalendarView';
import { CalendarCheck } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const CalendarPage = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <MonthlyCalendarView />
    </div>
  );
};

export default CalendarPage;