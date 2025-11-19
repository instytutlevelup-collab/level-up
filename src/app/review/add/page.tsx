"use client";
import { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export default function AddReviewPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState("");
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");

  const handleSubmit = async () => {
  console.log("Kliknięto Wyślij opinię");

  if (!firstName || !role || !stars || !comment) {
    alert("Wypełnij wszystkie wymagane pola.");
    return;
  }

  try {
    console.log("Próba dodania opinii do Firestore...");
    console.log("Dane:", { firstName, lastName, role, stars, comment });

    const docRef = await addDoc(collection(db, "reviews"), {
      firstName,
      lastName,
      role,
      stars,
      comment,
      createdAt: serverTimestamp(),
      approved: false
    });

    console.log("✅ Opinie zapisano! ID dokumentu:", docRef.id);
    alert("Dziękujemy za opinię! Twoje zdanie jest dla nas bardzo cenne.");
    setFirstName("");
    setLastName("");
    setRole("");
    setStars(5);
    setComment("");
  } catch (error) {
    console.error("❌ Błąd podczas zapisu do Firestore:", error);
    alert("Wystąpił błąd przy wysyłaniu opinii: " + (error as Error).message);
  }
};

  return (
    <div className="max-w-lg mx-auto mt-10">
      <Card>
        <CardHeader><CardTitle>Dodaj opinię</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Label>Imię*</Label>
          <Input value={firstName} onChange={e => setFirstName(e.target.value)} />

          <Label>Nazwisko (opcjonalnie)</Label>
          <Input value={lastName} onChange={e => setLastName(e.target.value)} />

          <Label>Rola*</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger><SelectValue placeholder="Wybierz rolę" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="uczeń">Uczeń</SelectItem>
              <SelectItem value="rodzic">Rodzic</SelectItem>
            </SelectContent>
          </Select>

          <Label>Ocena*</Label>
          <Select value={stars.toString()} onValueChange={v => setStars(Number(v))}>
            <SelectTrigger><SelectValue placeholder="Wybierz ocenę" /></SelectTrigger>
            <SelectContent>
              {[1,2,3,4,5].map(s => (
                <SelectItem key={s} value={s.toString()}>{'⭐'.repeat(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Label>Komentarz*</Label>
          <Textarea value={comment} onChange={e => setComment(e.target.value)} rows={4} />

          <Button type="button" onClick={handleSubmit}>Wyślij opinię</Button>
        </CardContent>
      </Card>
    </div>
  );
}