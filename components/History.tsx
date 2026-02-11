import React from 'react';
import { Log, Medicine } from '../types';
import { Check, X, Clock, Eye } from 'lucide-react';

interface HistoryProps {
  logs: Log[];
  medicines: Medicine[];
  onTakeLate: (date: Date) => void;
  onOpenFullHistory: () => void;
}

/**
 * Componente de histórico semanal de medicamentos.
 * Exibe o status de adesão de segunda a domingo da semana atual.
 * * @param {Log[]} logs - Lista de registros de medicamentos tomados.
 * @param {Medicine[]} medicines - Lista de medicamentos configurados.
 * @param {Function} onTakeLate - Função chamada ao marcar um medicamento atrasado.
 * @param {Function} onOpenFullHistory - Função para abrir a visualização completa do histórico.
 */
const History: React.FC<HistoryProps> = ({ logs, medicines, onTakeLate, onOpenFullHistory }) => {
  const days = Array.from({ length: 7 }, (_, i) => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - (day === 0 ? 6 : day - 1) + i;
    const d = new Date(now.getFullYear(), now.getMonth(), diff);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const getStatusForDay = (date: Date) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    const dayOfWeek = date.getDay();
    const requiredMeds = medicines.filter(m => m.daysOfWeek.includes(dayOfWeek));

    if (requiredMeds.length === 0) return 'none'; 

    const dayLogs = logs.filter(l => {
        const ld = new Date(l.takenAt);
        ld.setHours(0, 0, 0, 0);
        return ld.getTime() === date.getTime();
    });

    const allTaken = requiredMeds.every(m => dayLogs.some(l => l.medicineId === m.id));
    
    if (allTaken) {
        const hasLate = dayLogs.some(l => l.status === 'late');
        return hasLate ? 'late' : 'taken';
    }
    
    if (date.getTime() === now.getTime()) return 'pending';
    if (date.getTime() < now.getTime()) return 'missed';

    return 'pending';
  };

  return (
    <div className="w-full bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-4 transition-colors">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white">Semana Atual</h3>
        <button 
          onClick={onOpenFullHistory}
          className="p-2 text-blue-600 bg-blue-50 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-gray-600 rounded-full transition-colors"
          title="Ver histórico completo"
        >
          <Eye size={20} />
        </button>
      </div>
      
      <div className="flex justify-between items-center gap-1">
        {days.map((day, idx) => {
          const status = getStatusForDay(day);
          const isToday = day.toDateString() === new Date().toDateString();
          const dayName = day.toLocaleDateString('pt-BR', { weekday: 'short' })
                             .replace('.', '')
                             .substring(0, 3);
          const dayNum = day.getDate();

          let styles = '';
          let icon = null;

          switch(status) {
              case 'taken':
                  styles = 'bg-green-100 border-green-500 text-green-600 dark:bg-green-900/30 dark:text-green-400';
                  icon = <Check size={18} strokeWidth={3} />;
                  break;
              case 'late':
                  styles = 'bg-yellow-100 border-yellow-500 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400';
                  icon = <Clock size={18} strokeWidth={3} />;
                  break;
              case 'missed':
                  styles = 'bg-red-50 border-red-300 text-red-500 dark:bg-red-900/20 hover:bg-red-100 cursor-pointer';
                  icon = <X size={18} strokeWidth={3} />;
                  break;
              default:
                  styles = isToday 
                    ? 'border-blue-400 text-blue-500 bg-blue-50' 
                    : 'border-gray-200 text-gray-400 dark:border-gray-700';
                  icon = <span className="text-xs font-bold">{dayNum}</span>;
          }

          return (
            <div key={idx} className="flex flex-col items-center gap-2 flex-1">
              <span className={`text-[10px] font-bold uppercase tracking-tighter ${isToday ? 'text-blue-600' : 'text-gray-400'}`}>
                {dayName}
              </span>
              <button 
                onClick={() => status === 'missed' ? onTakeLate(day) : null}
                disabled={status !== 'missed'}
                className={`
                  w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center border-2 transition-all
                  ${styles}
                `}
              >
                {icon}
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex justify-center gap-4 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 text-[10px] font-medium text-gray-500">
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> OK</div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500"></span> ATRASADO</div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> PERDIDO</div>
      </div>
    </div>
  );
};

export default History;