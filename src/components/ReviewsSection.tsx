"use client";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ReviewsSection() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const fetchReviews = async () => {
      const q = query(
        collection(db, "reviews"),
        where("approved", "==", true),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      setReviews(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchReviews();
  }, []);

  const next = () => {
    if (currentIndex + 3 < reviews.length) setCurrentIndex(prev => prev + 3);
  };
  const prev = () => {
    if (currentIndex - 3 >= 0) setCurrentIndex(prev => prev - 3);
  };

  return (
    <section className="mt-10 text-center">
      <h2 className="text-2xl font-semibold mb-6">Opinie naszych Uczniów i Rodziców</h2>
      <div className="flex justify-center items-stretch gap-4 flex-wrap">
        {reviews.slice(currentIndex, currentIndex + 3).map((r) => (
          <Card key={r.id} className="w-72 shadow-md">
            <CardContent className="p-4 text-left">
              <p className="font-semibold">{r.firstName}</p>
              <p className="text-sm text-gray-500 mb-2">{r.role}</p>
              <div className="flex items-center mb-2">
                {"⭐".repeat(r.stars)}{"☆".repeat(5 - r.stars)}
              </div>
              <p className="text-gray-700">{r.comment}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-4 flex justify-center gap-4">
        <Button onClick={prev} disabled={currentIndex === 0}>← Poprzednie</Button>
        <Button onClick={next} disabled={currentIndex + 3 >= reviews.length}>Następne →</Button>
      </div>
    </section>
  );
}