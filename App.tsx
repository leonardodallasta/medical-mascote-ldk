import React, { useState, useEffect } from 'react';
import { Settings, Trash2, Bell, Plus, CheckCircle, Moon, Sun, Edit2, X, Clock, CircleUser, Sparkles } from 'lucide-react';
import Mascot from './components/Mascot';
import MedicineForm from './components/MedicineForm';
import History from './components/History';
import FoodPlan from './components/FoodPlan';
import Confetti from './components/Confetti';
import FullHistoryModal from './components/FullHistoryModal';
import { Medicine, Log, MascotStatus } from './types';
import * as db from './services/supabaseService';
import * as gemini from './services/geminiService';
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
  const [currentTime, setCurrentTime] = useState(new Date());

  // Hook handles calculation for global health
  const { status, streak } = useMascot(medicines, logs);

  // Update current time every minute to check for "Late" status
  // This is lightweight and doesn't overload the site.
  useEffect(() => {
      const interval = setInterval(() => setCurrentTime(new Date()), 60000);
      return () => clearInterval(interval);
  }, []);

  // Check for notifications
  // Note: On iOS PWA, background notifications (when app is closed) require Push API + Backend.
  // This local check works when app is open or recently backgrounded.
//   useEffect(() => {
//     if (Notification.permission !== 'granted') return;

//     const now = new Date();
//     const hours = String(now.getHours()).padStart(2, '0');
//     const minutes = String(now.getMinutes()).padStart(2, '0');
//     const currentHM = `${hours}:${minutes}`;
//     const dayOfWeek = now.getDay();

//     medicines.forEach(med => {
//         if (med.time === currentHM && med.daysOfWeek.includes(dayOfWeek)) {
//             // Check if already taken today
//             const isTaken = logs.some(l => {
//                 const d = new Date(l.takenAt);
//                 return l.medicineId === med.id && 
//                        d.getDate() === now.getDate() &&
//                        d.getMonth() === now.getMonth() &&
//                        d.getFullYear() === now.getFullYear();
//             });

//             if (!isTaken) {
//                 try {
//                     // Unique tag prevents spamming the same notification
//                     const tag = `med-${med.id}-${now.toDateString()}-${currentHM}`;
//                     new Notification(`✨ Dia Leve`, {
//                         body: `Psiu! ${gender === 'female' ? 'A sua mascote' : 'O seu mascote'} tá esperando! Hora do ${med.name}.`,
//                         icon: '/vite.svg',
//                         tag: tag
//                     });
//                 } catch (e) {
//                     console.error("Failed to send notification", e);
//                 }
//             }
//         }
//     });
//   }, [currentTime, medicines, logs, gender]);

  // Initialize Dark Mode and Gender Correctly
  useEffect(() => {
    // Check local storage or system preference
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

    useEffect(() => {
    const init = async () => {
        await OneSignal.init({
        appId: '56e42826-b0c3-4776-8e97-e677dd8fa050',
        allowLocalhostAsSecureOrigin: true,
        })

        const permission = await OneSignal.Notifications.permission

        if (permission === false) {
        await OneSignal.Slidedown.promptPush()
        }
    }

    init()
    }, [])

  const toggleTheme = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const toggleGender = () => {
      const newGender = gender === 'male' ? 'female' : 'male';
      setGender(newGender);
      localStorage.setItem('gender', newGender);
  };

  // Load Initial Data
  useEffect(() => {
    const loadData = async () => {
      try {
        const savedMeds = await db.getMedicines();
        setMedicines(savedMeds);
        const savedLogs = await db.getLogs();
        setLogs(savedLogs);
      } catch (e) {
        console.error("Failed to load data from Supabase", e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleSaveMedicine = async (newMed: Medicine) => {
    // Optimistic UI update
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
    // Refresh to ensure sync
    const updatedMeds = await db.getMedicines();
    setMedicines(updatedMeds);
    
    setEditingId(null);
    setIsAdding(false);
    
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (window.confirm('Tem certeza que deseja excluir este remédio? Todo o histórico dele será apagado.')) {
      setMedicines(prev => prev.filter(m => m.id !== id)); // Optimistic
      await db.deleteMedicine(id);
      
      // Refresh
      const updatedMeds = await db.getMedicines();
      setMedicines(updatedMeds);
      const updatedLogs = await db.getLogs();
      setLogs(updatedLogs);
      setEditingId(null);
    }
  };

  const handleTakeMedicine = async (medId: string, isLate: boolean = false, dateOverride?: Date) => {
    const timestamp = dateOverride ? dateOverride.getTime() : Date.now();
    
    const newLog: Log = {
      id: crypto.randomUUID(),
      medicineId: medId,
      takenAt: timestamp,
      status: isLate ? 'late' : 'taken'
    };

    // Optimistic update
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
    const today = new Date();
    return logs.find(l => {
        const d = new Date(l.takenAt);
        return l.medicineId === medId && 
               d.getDate() === today.getDate() &&
               d.getMonth() === today.getMonth() &&
               d.getFullYear() === today.getFullYear();
    });
  };

  const checkIsLate = (timeStr: string) => {
    const [hours, mins] = timeStr.split(':').map(Number);
    const now = new Date();
    const medTime = new Date();
    medTime.setHours(hours, mins, 0, 0);
    const diffMs = now.getTime() - medTime.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours > 1;
  };

  const getMascotMessage = () => {
    const today = new Date();
    const todayIdx = today.getDay();
    const requiredToday = medicines.filter(m => m.daysOfWeek.includes(todayIdx));
    
    const allTakenToday = requiredToday.length > 0 && requiredToday.every(m => !!getTodayLog(m.id));

    if (allTakenToday) {
        return "Tudo pago por hoje! É sobre isso!";
    }

    const messages = MASCOT_MESSAGES[status];
    return messages[Math.floor(Math.random() * messages.length)];
  };

  const getTodaysMedicines = () => {
      const todayIdx = new Date().getDay();
      return medicines.filter(m => m.daysOfWeek.includes(todayIdx));
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-500">
        <div className="text-center">
            <Sparkles className="animate-spin text-primary mx-auto mb-2" size={32} />
            <p>Preparando seu dia...</p>
        </div>
    </div>;
  }

  // Editing or Adding View
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
             <button 
                onClick={(e) => handleDelete(editingId, e)}
                className="fixed bottom-8 left-1/2 transform -translate-x-1/2 text-red-500 font-bold underline flex items-center gap-2"
            >
                <Trash2 size={16} /> Excluir este remédio
            </button>
        )}
      </div>
    );
  }

  const todaysMedicines = getTodaysMedicines();

  return (
    <div className="min-h-screen bg-[#f0f2f5] dark:bg-gray-900 transition-colors pb-20 safe-area-bottom">
      {showConfetti && <Confetti />}

      <FullHistoryModal 
        isOpen={showHistoryModal} 
        onClose={() => setShowHistoryModal(false)}
        logs={logs}
        medicines={medicines}
      />

      {/* Header */}
      <header className="bg-white dark:bg-gray-800 p-4 shadow-sm flex justify-between items-center sticky top-0 z-20 transition-colors">
        <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-info flex items-center gap-2">
            ✨ Dia Leve
        </h1>
        <div className="flex gap-2">
            <button 
                onClick={toggleGender}
                className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center transition-colors font-bold text-xs ${gender === 'female' ? 'bg-pink-100 text-pink-600 dark:bg-pink-900/30' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30'}`}
                title="Mudar gênero do mascote"
            >
                <CircleUser size={20} strokeWidth={2.5} />
            </button>
            <button 
                onClick={toggleTheme}
                className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-yellow-400 transition-colors"
                title={darkMode ? "Mudar para modo claro" : "Mudar para modo escuro"}
            >
                {darkMode ? <Sun size={20} strokeWidth={2.5} /> : <Moon size={20} strokeWidth={2.5} />}
            </button>
            <button 
                onClick={() => setIsAdding(true)}
                className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-primary text-white hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30"
            >
                <Plus size={24} strokeWidth={3} />
            </button>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6">
        
        {/* Mascot Area */}
        <section className="mt-2">
           <Mascot status={status} message={getMascotMessage()} gender={gender} />
        </section>

        {/* Food Plan Button */}
        <FoodPlan />

        {/* Today's Medicines List */}
        <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-3">Para Hoje</h3>
            {todaysMedicines.length === 0 ? (
                <div className="text-center py-8 text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="mb-2">😴</div>
                    <p>Dia livre! Nenhum remédio hoje.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {todaysMedicines.map(med => {
                        const todayLog = getTodayLog(med.id);
                        const taken = !!todayLog;
                        const late = !taken && checkIsLate(med.time);

                        const takenTime = todayLog 
                            ? new Date(todayLog.takenAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                            : null;

                        return (
                            <div key={med.id} className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col gap-3 transition-colors relative">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-bold text-gray-800 dark:text-white text-lg leading-none">{med.name}</h4>
                                            {streak > 0 && (
                                                <span className="flex items-center gap-0.5 text-orange-500 font-bold text-sm bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-full border border-orange-100 dark:border-orange-800/30 animate-pulse-slow" title="Dias seguidos (Streak)">
                                                    🔥 {streak}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{med.time} • {med.reason}</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button 
                                            onClick={() => setEditingId(med.id)}
                                            className="w-8 h-8 flex items-center justify-center flex-shrink-0 text-gray-300 hover:text-primary transition-colors bg-gray-50 dark:bg-gray-700 rounded-full"
                                            title="Editar"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                         <button 
                                            onClick={(e) => handleDelete(med.id, e)}
                                            className="w-8 h-8 flex items-center justify-center flex-shrink-0 text-gray-300 hover:text-danger transition-colors bg-gray-50 dark:bg-gray-700 rounded-full"
                                            title="Excluir"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                
                                <button
                                    onClick={() => handleTakeMedicine(med.id, late)}
                                    disabled={taken}
                                    className={`
                                        w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95
                                        ${taken 
                                            ? 'bg-success/10 text-success dark:bg-green-900/30 dark:text-green-400 cursor-default' 
                                            : status === MascotStatus.DEAD 
                                                ? 'bg-gray-700 text-gray-200 hover:bg-gray-600 shadow-md' 
                                                : late
                                                    ? 'bg-warning text-yellow-900 shadow-md hover:bg-yellow-500' 
                                                    : 'bg-primary text-white shadow-md hover:bg-blue-600'
                                        }
                                    `}
                                >
                                    {taken ? (
                                        <> <CheckCircle size={20} /> Tomado às {takenTime} </>
                                    ) : late ? (
                                        <> <Clock size={20} /> Tomar com Atraso </>
                                    ) : (
                                        <> <Bell size={20} /> {status === MascotStatus.DEAD ? 'Reviver Mascote' : 'Tomar'} </>
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
        
        {status === MascotStatus.DEAD && (
             <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-900 text-center">
                <p className="text-danger mb-2 font-medium">Seu mascote morreu...</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Tome seu remédio agora para revivê-lo!</p>
            </div>
        )}

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