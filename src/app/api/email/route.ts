import { NextResponse } from 'next/server';

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
        subject: 'Sukces! Powiadomienia działają',
        html: '<p>Witaj! Twój nowy kod wysyłania e-maili działa bezbłędnie.</p>',
      }),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Wystąpił błąd podczas wysyłania" }, { status: 500 });
  }
}