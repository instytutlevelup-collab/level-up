export async function POST() {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Powiadomienia <onboarding@resend.dev>',
        to: ['instytut.levelup@gmail.com'],
        subject: 'Potwierdzenie rezerwacji korepetycji',
        html: '<p>Hurra! To jest testowe powiadomienie z Twojej aplikacji.</p>',
      }),
    });

    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    return Response.json({ error: "Wystąpił błąd podczas wysyłania" }, { status: 500 });
  }
}