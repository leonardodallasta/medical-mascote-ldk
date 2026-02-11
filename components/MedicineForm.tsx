import React, { useState } from 'react';
import { Medicine } from '../types';
import { Clock } from 'lucide-react';

interface MedicineFormProps {
  initialData?: Medicine | null;
  onSave: (medicine: Medicine) => void;
  onCancel?: () => void;
}

const MedicineForm: React.FC<MedicineFormProps> = ({ initialData, onSave, onCancel }) => {
  const [name, setName] = useState(initialData?.name || '');
  const [reason, setReason] = useState(initialData?.reason || '');
  const [time, setTime] = useState(initialData?.time || '08:00');
  const [days, setDays] = useState<number[]>(initialData?.daysOfWeek || [0,1,2,3,4,5,6]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !time || days.length === 0) {
        alert("Preencha o nome, horário e selecione pelo menos um dia.");
        return;
    }

    const newMedicine: Medicine = {
      id: initialData?.id || crypto.randomUUID(),
      name,
      reason,
      time,
      daysOfWeek: days,
      createdAt: initialData?.createdAt || Date.now(),
    };
    onSave(newMedicine);
  };

  const toggleDay = (dayIndex: number) => {
      setDays(prev => 
        prev.includes(dayIndex) 
        ? prev.filter(d => d !== dayIndex) 
        : [...prev, dayIndex]
      );
  };

  const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  return (
    <div className="w-full max-w-md mx-auto bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg animate-fade-in-up transition-colors">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 text-center">
        {initialData ? 'Editar Remédio' : 'Novo Remédio'}
      </h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome do remédio</label>
          <input
            type="text"
            className="w-full p-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
            placeholder="Ex: Vitamina C"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Motivo (Opcional)</label>
          <input
            type="text"
            className="w-full p-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
            placeholder="Ex: Imunidade"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

<div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Horário
          </label>
          <input
            type="time"
            required
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full h-14 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-center text-xl font-bold"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              paddingInlineStart: '0',
              paddingInlineEnd: '0'
            }}
          />
        </div>

        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Dias da semana</label>
            <div className="flex justify-between gap-1 overflow-x-auto pb-1">
                {weekDays.map((label, idx) => {
                    const isSelected = days.includes(idx);
                    return (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => toggleDay(idx)}
                            className={`
                                w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all flex-shrink-0
                                ${isSelected 
                                    ? 'bg-primary text-white shadow-md transform scale-105' 
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }
                            `}
                        >
                            {label}
                        </button>
                    )
                })}
            </div>
        </div>

        <div className="flex gap-3 mt-4">
           {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-4 px-6 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            className="flex-1 py-4 px-6 rounded-xl bg-primary text-white font-bold text-lg shadow-lg hover:bg-blue-600 transition-transform active:scale-95"
          >
            Salvar
          </button>
        </div>
      </form>
    </div>
  );
};

export default MedicineForm;