// Caminho: supabase/functions/check-medicines/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// SUAS MENSAGENS DIVERTIDAS AQUI
const FUN_MESSAGES = [
  "Vai tomar seu remédio, cabeção! 🤪",
  "Oi coisa linda, vê se toma seu remédio hein! ❤️",
  "Alô? É da central de saúde? Tão mandando você se cuidar! 📞",
  "Seu mascote tá te julgando... hora do remédio! 👀",
  "Para tudo o que tá fazendo e pega água! 💧",
  "Um brinde à saúde (com água e remédio)! 🥂",
  "Não me obrigue a notificar de novo... 😤",
  "Bora ficar saudável pra aguentar a semana! 💪",
  "Você prometeu que ia se cuidar, lembra? 🤔",
  "Dinheiro não compra saúde, mas esse lembrete é grátis! 💸"
]

Deno.serve(async (req) => {
  // Cria a conexão com o banco
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // 1. Pega a hora atual do BRASIL
  const now = new Date()
  const options = { timeZone: "America/Sao_Paulo", hour12: false }
  const brazilDateStr = now.toLocaleString("en-US", options)
  const brazilTime = new Date(brazilDateStr)
  
  const currentHour = brazilTime.getHours().toString().padStart(2, '0')
  const currentMinute = brazilTime.getMinutes().toString().padStart(2, '0')
  const currentTime = `${currentHour}:${currentMinute}` // Ex: "08:00"
  
  const currentDay = brazilTime.getDay() // 0 = Domingo, 1 = Segunda...

  console.log(`Verificando remédios para: ${currentTime}, dia da semana: ${currentDay}`)

  try {
    // 2. Busca remédios no horário certo
    const { data: medicines, error } = await supabase
      .from('medicines')
      .select('*')
      .eq('time', currentTime)

    if (error) throw error

    // 3. Filtra se é o dia da semana certo
    const medsToNotify = medicines.filter(med => {
      return Array.isArray(med.days_of_week) && med.days_of_week.includes(currentDay)
    })

    if (medsToNotify.length === 0) {
      return new Response(JSON.stringify({ message: 'Nenhum remédio agora' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 4. Manda as notificações
    const notifications = medsToNotify.map(async (med) => {
      // Sorteia a mensagem
      const randomMsg = FUN_MESSAGES[Math.floor(Math.random() * FUN_MESSAGES.length)]

      const payload = {
        app_id: Deno.env.get('ONESIGNAL_APP_ID'),
        included_segments: ["All"], // Manda pra todo mundo
        headings: { 
          en: `Hora do ${med.name} 💊`, 
          pt: `Hora do ${med.name} 💊` 
        },
        contents: { 
          en: randomMsg, 
          pt: randomMsg 
        },
        url: "https://medical-mascote-ldk.vercel.app", // Seu site
      }

      // Chama o OneSignal
      const response = await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get('ONESIGNAL_REST_API_KEY')}`,
        },
        body: JSON.stringify(payload),
      })
      
      return response.json()
    })

    await Promise.all(notifications)

    return new Response(
      JSON.stringify({ success: true, meds_notified: medsToNotify.map(m => m.name) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})