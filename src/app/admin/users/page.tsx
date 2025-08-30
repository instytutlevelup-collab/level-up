"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import TutorsSection from "@/components/admin/users/TutorsSection"
import StudentsSection from "@/components/admin/users/StudentsSection"
import ParentsSection from "@/components/admin/users/ParentsSection"
import AllUsersSection from "@/components/admin/users/AllUsersSection"

export default function AdminUsersPage() {
  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4">Użytkownicy</h1>
      <Tabs defaultValue="tutors" className="mt-4">
        <TabsList>
          <TabsTrigger value="tutors">Korepetytorzy</TabsTrigger>
          <TabsTrigger value="students">Uczniowie</TabsTrigger>
          <TabsTrigger value="parents">Rodzice</TabsTrigger>
          <TabsTrigger value="all">Wszyscy</TabsTrigger>
        </TabsList>

        <TabsContent value="tutors">
          <TutorsSection />
        </TabsContent>
        <TabsContent value="students">
          <StudentsSection />
        </TabsContent>
        <TabsContent value="parents">
          <ParentsSection />
        </TabsContent>
        <TabsContent value="all">
          <AllUsersSection />
        </TabsContent>
      </Tabs>
    </div>
  )
}
