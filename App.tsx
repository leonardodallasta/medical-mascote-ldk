import React, { useState, useEffect, useMemo } from 'react';
import { Settings, Trash2, Bell, Plus, CheckCircle, Moon, Sun, Edit2, X, Clock, CircleUser, Sparkles } from 'lucide-react';
import Mascot from './components/Mascot';
import MedicineForm from './components/MedicineForm';
import History from './components/History';
import FoodPlan from './components/FoodPlan';
import Confetti from './components/Confetti';
import FullHistoryModal from './components/FullHistoryModal';
import { Medicine, Log, MascotStatus } from './types';
import * as db from './services/supabaseService';
import { useMascot } from './hooks/useMascot';
import { MASCOT_MESSAGES } from './constants';
import OneSignal from 'react-onesignal';

function App() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const { status, streak } = useMascot(medicines, logs);

  // Inicializa OneSignal
  useEffect(() => {
    const initOneSignal = async () => {
      try {
        await OneSignal.init({
          appId: '56e42826-b0c3-4776-8e97-e677dd8fa050',
          allowLocalhostAsSecureOrigin: true,
        });
      } catch (err) {
        console.error("Erro ao inicializar OneSignal:", err);
      }
    };
    initOneSignal();
  }, []);

  // Tema e Gênero
  useEffect(() => {
    const storedTheme = localStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = storedTheme === 'dark' || (!storedTheme && systemDark);
    
    setDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    const storedGender = localStorage.getItem('gender');
    if (storedGender === 'female') setGender('female');
  }, []);

  // Carregar Dados
  useEffect(() => {
    const loadData = async () => {
      try {
        const savedMeds = await db.getMedicines();
        setMedicines(savedMeds);
        const savedLogs = await db.getLogs();
        setLogs(savedLogs);
      } catch (e) {
        console.error("Erro ao carregar dados do Supabase", e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const toggleTheme = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    document.documentElement.classList.toggle('dark', newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
  };

  const toggleGender = () => {
    const newGender = gender === 'male' ? 'female' : 'male';
    setGender(newGender);
    localStorage.setItem('gender', newGender);
  };

  const handleSaveMedicine = async (newMed: Medicine) => {
    setMedicines(prev => {
      const idx = prev.findIndex(m => m.id === newMed.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = newMed;
        return copy;
      }
      return [...prev, newMed];
    });

    await db.saveMedicine(newMed);
    const updatedMeds = await db.getMedicines();
    setMedicines(updatedMeds);
    
    setEditingId(null);
    setIsAdding(false);

    if (OneSignal.Notifications.permission === false) {
      await OneSignal.Slidedown.promptPush();
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (window.confirm('Tem certeza que deseja excluir este remédio? Todo o histórico dele será apagado.')) {
      setMedicines(prev => prev.filter(m => m.id !== id));
      await db.deleteMedicine(id);
      const updatedMeds = await db.getMedicines();
      setMedicines(updatedMeds);
      const updatedLogs = await db.getLogs();
      setLogs(updatedLogs);
      setEditingId(null);
    }
  };

  const handleTakeMedicine = async (medId: string, isLate: boolean = false, dateOverride?: Date) => {
    if (!OneSignal.Notifications.permission) {
      OneSignal.Slidedown.promptPush();
    }

    const timestamp = dateOverride ? dateOverride.getTime() : Date.now();
    const newLog: Log = {
      id: crypto.randomUUID(),
      medicineId: medId,
      takenAt: timestamp,
      status: isLate ? 'late' : 'taken'
    };

    setLogs(prev => [...prev, newLog]);
    await db.saveLog(newLog);
    
    if (!isLate) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    }
  };

  const handleTakeLateBatch = async (date: Date) => {
    const dayIndex = date.getDay();
    const requiredMeds = medicines.filter(m => m.daysOfWeek.includes(dayIndex));
    
    if (confirm(`Marcar todos os remédios de ${date.toLocaleDateString()} como tomados com atraso?`)) {
      for (const med of requiredMeds) {
        await handleTakeMedicine(med.id, true, date);
      }
    }
  };

  const getTodayLog = (medId: string): Log | undefined => {
    const todayStr = new Date().toDateString();
    return logs.find(l => l.medicineId === medId && new Date(l.takenAt).toDateString() === todayStr);
  };

  const checkIsLate = (timeStr: string) => {
    const [hours, mins] = timeStr.split(':').map(Number);
    const now = new Date();
    const medTime = new Date();
    medTime.setHours(hours, mins, 0, 0);
    return (now.getTime() - medTime.getTime()) / (1000 * 60 * 60) > 1;
  };

  // --- LÓGICA DE MENSAGENS ---
  
  // 1. Calcula se tudo foi tomado hoje (memorizado para não recalcular à toa)
  const allTakenToday = useMemo(() => {
    const todayIdx = new Date().getDay();
    const requiredToday = medicines.filter(m => m.daysOfWeek.includes(todayIdx));
    // Se não tem remédio hoje, não conta como "tudo tomado" para mensagem de parabéns,
    // mas o mascote fica feliz por padrão. Ajuste conforme gosto.
    if (requiredToday.length === 0) return false; 
    
    return requiredToday.every(m => !!getTodayLog(m.id));
  }, [medicines, logs]);

  // 2. Escolhe a mensagem e TRAVA ela (só muda se o status ou o allTaken mudar)
  const mascotMessage = useMemo(() => {
    // Se tomou tudo, pega aleatória do HAPPY
    if (allTakenToday) {
      const happyMessages = MASCOT_MESSAGES[MascotStatus.HAPPY];
      return happyMessages[Math.floor(Math.random() * happyMessages.length)];
    }
    
    // Se não, pega do status atual
    const messages = MASCOT_MESSAGES[status];
    return messages[Math.floor(Math.random() * messages.length)];
  }, [status, allTakenToday]); 

  // -------------------------------------

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-500">
        <div className="text-center">
          <Sparkles className="animate-spin text-primary mx-auto mb-2" size={32} />
          <p>Preparando seu dia...</p>
        </div>
      </div>
    );
  }

  if (isAdding || editingId) {
    const medToEdit = editingId ? medicines.find(m => m.id === editingId) : null;
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 flex items-center justify-center">
        <MedicineForm 
          initialData={medToEdit} 
          onSave={handleSaveMedicine} 
          onCancel={() => { setIsAdding(false); setEditingId(null); }} 
        />
        {editingId && (
          <button onClick={(e) => handleDelete(editingId, e)} className="fixed bottom-8 left-1/2 transform -translate-x-1/2 text-red-500 font-bold underline flex items-center gap-2">
            <Trash2 size={16} /> Excluir este remédio
          </button>
        )}
      </div>
    );
  }

  const todaysMedicines = medicines.filter(m => m.daysOfWeek.includes(new Date().getDay()));

  return (
    <div className="min-h-screen bg-[#f0f2f5] dark:bg-gray-900 transition-colors pb-20 safe-area-bottom">
      {showConfetti && <Confetti />}

      <FullHistoryModal 
        isOpen={showHistoryModal} 
        onClose={() => setShowHistoryModal(false)}
        logs={logs}
        medicines={medicines}
      />

      <header className="bg-white dark:bg-gray-800 p-4 shadow-sm flex justify-between items-center sticky top-0 z-20">
        <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-info flex items-center gap-2">
          ✨ Dia Leve
        </h1>
        <div className="flex gap-2">
          <button onClick={toggleGender} className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${gender === 'female' ? 'bg-pink-100 text-pink-600 dark:bg-pink-900/30' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30'}`}>
            <CircleUser size={20} strokeWidth={2.5} />
          </button>
          <button onClick={toggleTheme} className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-yellow-400">
            {darkMode ? <Sun size={20} strokeWidth={2.5} /> : <Moon size={20} strokeWidth={2.5} />}
          </button>
          <button onClick={() => setIsAdding(true)} className="w-10 h-10 flex items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-blue-500/30">
            <Plus size={24} strokeWidth={3} />
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6">
        {/* Passamos a variável travada mascotMessage, não a função */}
        <Mascot status={status} message={mascotMessage} gender={gender} />
        <FoodPlan />

        <div>
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-3">Para Hoje</h3>
          {todaysMedicines.length === 0 ? (
            <div className="text-center py-8 text-gray-400 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
              <p>😴 Dia livre! Nenhum remédio hoje.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todaysMedicines.map(med => {
                const todayLog = getTodayLog(med.id);
                const taken = !!todayLog;
                const late = !taken && checkIsLate(med.time);
                const takenTime = todayLog ? new Date(todayLog.takenAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null;

                return (
                  <div key={med.id} className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-gray-800 dark:text-white text-lg">{med.name}</h4>
                          {streak > 0 && <span className="text-orange-500 font-bold text-sm bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">🔥 {streak}</span>}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{med.time} • {med.reason}</p>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => setEditingId(med.id)} className="w-8 h-8 flex items-center justify-center text-gray-300 bg-gray-50 dark:bg-gray-700 rounded-full"><Edit2 size={16} /></button>
                        <button onClick={(e) => handleDelete(med.id, e)} className="w-8 h-8 flex items-center justify-center text-gray-300 bg-gray-50 dark:bg-gray-700 rounded-full"><Trash2 size={16} /></button>
                      </div>
                    </div>
                    <button
                      onClick={() => handleTakeMedicine(med.id, late)}
                      disabled={taken}
                      className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${taken ? 'bg-success/10 text-success' : late ? 'bg-warning text-yellow-900' : 'bg-primary text-white'}`}
                    >
                      {taken ? <><CheckCircle size={20} /> Tomado às {takenTime}</> : late ? <><Clock size={20} /> Tomar com Atraso</> : <><Bell size={20} /> Tomar</>}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <History 
          logs={logs} 
          medicines={medicines} 
          onTakeLate={handleTakeLateBatch} 
          onOpenFullHistory={() => setShowHistoryModal(true)} 
        />
      </main>
    </div>
  );
}

export default App;