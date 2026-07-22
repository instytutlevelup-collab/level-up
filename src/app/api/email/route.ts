import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // 1. Odbieramy paczkę danych z Twojej aplikacji
    const body = await request.json();
    const { to, subject, html } = body;

    // 2. Sprawdzamy, czy aplikacja wysłała wszystko, co potrzebne
    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: "Brakuje odbiorcy, tematu lub treści wiadomości." }, 
        { status: 400 }
      );
    }

    // 3. Wysyłamy e-mail przez system Resend
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Powiadomienia <onboarding@resend.dev>',
        to: Array.isArray(to) ? to : [to], // Pozwala wysłać do jednej osoby lub do całej grupy na raz (np. tutor + rodzic + uczeń)
        subject: subject,
        html: html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Błąd z Resend:", data);
      return NextResponse.json({ error: "Błąd po stronie serwera pocztowego" }, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Błąd API Email:", error);
    return NextResponse.json({ error: "Wystąpił błąd podczas przetwarzania" }, { status: 500 });
  }
}