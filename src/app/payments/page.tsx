'use client'

import { useState, useEffect } from 'react'
import { db, auth } from '@/lib/firebase'
import { collection, getDocs, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface MonthlySettlement {
  id?: string
  month: string
  plannedHours?: number
  totalHoursToPay: number
  paidHours: number
  completedHours: number
  balance: number
  carriedOverHours?: number
  paymentDate?: string
  notes?: string
  studentId?: string
  createdAt?: string
  createdBy?: string
  studentName?: string
}

interface User {
  id: string
  accountType: string
  childrenIds?: string[]
}

// Removed unused functions: generateLast12Months, normalizeYYYYMM, formatYYYYMM, monthsBackToStart

// Helper to resolve children IDs for parent user
interface ParentData {
  linkedAccounts?: { studentId?: string }[]
}
async function resolveChildrenIdsForParent(parentUid: string): Promise<string[]> {
  try {
    const parentDocSnap = await getDoc(doc(db, 'users', parentUid))
    if (!parentDocSnap.exists()) return []

  const parentData = parentDocSnap.data() as ParentData
  const linkedAccounts = Array.isArray(parentData.linkedAccounts) ? parentData.linkedAccounts : []

  // Zwracamy tablicę studentId jako string[]
  return linkedAccounts
    .map((acc) => acc.studentId)
    .filter((id): id is string => typeof id === "string" && id.trim() !== "");
  } catch {
    console.error('Błąd resolveChildrenIdsForParent')
    return []
  }
}

export default function PaymentsPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [students, setStudents] = useState<{ id: string; fullName: string }[]>([])
  const [selectedStudent, setSelectedStudent] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [settlements, setSettlements] = useState<MonthlySettlement[]>([])
  const [plannedHours, setPlannedHours] = useState<number>(0);
  const [completedHours, setCompletedHours] = useState<number>(0);
  const [balance, setBalance] = useState<number>(0);
  const [carriedOverHours, setCarriedOverHours] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  // For editing settlements
  const [editingSettlements, setEditingSettlements] = useState<Record<string, Partial<MonthlySettlement>>>({});
  const [savingSettlements, setSavingSettlements] = useState<Record<string, boolean>>({});

  // Fetch current user and initial data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const usersSnap = await getDocs(collection(db, 'users'))
        const userDoc = usersSnap.docs.find(doc => doc.id === user.uid)
        const accountType = userDoc?.data().accountType || ''
        const childrenIds = userDoc?.data().childrenIds || []
        if (accountType === 'tutor' || accountType === 'admin') {
          setCurrentUser({ id: user.uid, accountType, childrenIds })
          // Fetch all students for dropdown
          const studentsList = usersSnap.docs
            .filter(doc => doc.data().accountType === 'student')
            .map(doc => {
              const data = doc.data()
              const fullName = data.name || ((data.firstName || '') + ' ' + (data.lastName || '')).trim() || doc.id
              return { id: doc.id, fullName }
            })
          setStudents(studentsList)
          if (studentsList.length > 0) setSelectedStudent(studentsList[0].id)
        } else if (accountType === 'student') {
          setCurrentUser({ id: user.uid, accountType, childrenIds })
          setSelectedStudent(user.uid)
          fetchSettlements(user.uid)
        } else if (accountType === 'parent') {
          const resolvedChildren = await resolveChildrenIdsForParent(user.uid)
          setCurrentUser({ id: user.uid, accountType, childrenIds: resolvedChildren })
          setSelectedStudent('')
          fetchSettlementsForParent(resolvedChildren)
        }
      } else {
        setCurrentUser(null)
        setStudents([])
        setSelectedStudent('')
        setSelectedMonth('')
        setSettlements([])
      }
    })
    return () => unsubscribe()
  }, [])

  // No availableMonths logic needed

  // Fetch settlements for student
  const fetchSettlements = async (studentId: string) => {
    if (!studentId) return
    const settlementsRef = collection(db, 'users', studentId, 'monthlySettlements')
    const snap = await getDocs(settlementsRef)
    let data = snap.docs.map(doc => {
      const d = doc.data()
      return {
        id: doc.id,
        studentId,
        ...d,
        completedHours: Number(d.completedHours) || 0,
        totalHoursToPay: Number(d.totalHoursToPay) || 0,
        paidHours: Number(d.paidHours) || 0,
        balance: Number(d.balance) || 0,
        carriedOverHours: d.carriedOverHours !== undefined ? Number(d.carriedOverHours) : 0,
      } as MonthlySettlement
    })
    // Filter unique by studentId and month
    const uniqueMap = new Map<string, MonthlySettlement>()
    data.forEach(s => {
      const key = `${s.studentId}-${s.month}`
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, s)
      }
    })
    data = Array.from(uniqueMap.values())
    // Sort by month descending
    data.sort((a, b) => (b.month > a.month ? 1 : b.month < a.month ? -1 : 0))
    setSettlements(data)
  }

  // Fetch settlements for all children of parent
  const fetchSettlementsForParent = async (childrenIds: string[]) => {
    console.log("childrenIds rodzica:", childrenIds);
    let allSettlements: MonthlySettlement[] = []
    for (const childId of childrenIds) {
      console.log("Pobieram rozliczenia dla dziecka:", childId);
      // Get child name
      let studentName = childId
      try {
        const userDocRef = doc(db, 'users', childId)
        const userDocSnap = await getDoc(userDocRef)
        if (userDocSnap.exists()) {
          const udata = userDocSnap.data()
          studentName =
            udata.name ||
            [udata.firstName, udata.lastName].filter(Boolean).join(' ').trim() ||
            childId
        }
      } catch {
        // fallback to childId
      }
      const settlementsRef = collection(db, 'users', childId, 'monthlySettlements')
      const snap = await getDocs(settlementsRef)
      const childSettlements = snap.docs.map(doc => {
        const d = doc.data()
        return {
          id: doc.id,
          studentId: childId,
          ...d,
          completedHours: Number(d.completedHours) || 0,
          totalHoursToPay: Number(d.totalHoursToPay) || 0,
          paidHours: Number(d.paidHours) || 0,
          balance: Number(d.balance) || 0,
          carriedOverHours: d.carriedOverHours !== undefined ? Number(d.carriedOverHours) : 0,
          studentName,
        } as MonthlySettlement
      })
      console.log("Rozliczenia pobrane:", childSettlements);
      allSettlements = allSettlements.concat(childSettlements)
    }
    // Filter unique by studentId and month
    const uniqueMap = new Map<string, MonthlySettlement>()
    allSettlements.forEach(s => {
      const key = `${s.studentId}-${s.month}`
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, s)
      }
    })
    allSettlements = Array.from(uniqueMap.values())
    // Sort by month descending
    allSettlements.sort((a, b) => (b.month > a.month ? 1 : b.month < a.month ? -1 : 0))
    setSettlements(allSettlements)
  }

  const handleSaveSettlement = async () => {
    try {
      // Walidacja: czy wybrano ucznia i miesiąc?
      if (!selectedStudent) {
        alert('Wybierz ucznia przed zapisaniem rozliczenia.');
        return;
      }
      if (!selectedMonth) {
        alert('Wybierz miesiąc przed zapisaniem rozliczenia.');
        return;
      }
      const settlementsRef = collection(db, 'users', selectedStudent, 'monthlySettlements');
      // Build settlement object with all required fields
      const settlementData: Omit<MonthlySettlement, "id"> & { createdAt: string; createdBy: string } = {
        studentId: selectedStudent,
        month: selectedMonth,
        plannedHours: plannedHours,
        completedHours: completedHours,
        totalHoursToPay: 0,
        paidHours: 0,
        balance: balance,
        carriedOverHours: carriedOverHours,
        notes: notes,
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.id || ''
      };
      if (paymentDate) {
        settlementData.paymentDate = paymentDate;
      }
      await addDoc(settlementsRef, settlementData);
      // Po udanym zapisie wyczyść pola formularza
      setPlannedHours(0);
      setCompletedHours(0);
      setBalance(0);
      setCarriedOverHours(0);
      setPaymentDate('');
      setNotes('');
      // odśwież dane
      if (currentUser?.accountType === 'student') {
        fetchSettlements(currentUser.id);
      } else if (currentUser?.accountType === 'parent' && currentUser?.childrenIds) {
        fetchSettlementsForParent(currentUser.childrenIds);
      } else if (currentUser?.accountType === 'tutor' || currentUser?.accountType === 'admin') {
        fetchSettlements(selectedStudent);
      }
    } catch (error) {
      console.error('Błąd podczas zapisywania rozliczenia:', error);
      alert('Wystąpił błąd podczas zapisywania rozliczenia. Spróbuj ponownie.');
    }
  };

  // Handle change for editing settlement fields
  const handleEditSettlementField = (settlementId: string, field: keyof MonthlySettlement, value: string | number) => {
    setEditingSettlements(prev => ({
      ...prev,
      [settlementId]: {
        ...prev[settlementId],
        [field]: value,
      }
    }));
  };

  // Update settlement in Firestore
  const handleUpdateSettlement = async (settlementId: string, updatedData: Partial<MonthlySettlement>) => {
    if (!selectedStudent || !settlementId) return;
    setSavingSettlements(prev => ({ ...prev, [settlementId]: true }));
    try {
      await updateDoc(doc(db, 'users', selectedStudent, 'monthlySettlements', settlementId), updatedData);
      // After update, refresh settlements
      await fetchSettlements(selectedStudent);
      // Clear edit state for this settlement
      setEditingSettlements(prev => {
        const rest = { ...prev };
        delete rest[settlementId];
        return rest;
      });
    } catch (error) {
      alert('Błąd podczas zapisywania zmian rozliczenia.');
      console.error(error);
    }
    setSavingSettlements(prev => ({ ...prev, [settlementId]: false }));
  };

  const isTutorOrAdmin = currentUser?.accountType === 'tutor' || currentUser?.accountType === 'admin'
  const isStudent = currentUser?.accountType === 'student'
  const isParent = currentUser?.accountType === 'parent'

  // For parent: group settlements by studentId
  const groupedSettlements: Record<string, MonthlySettlement[]> = {}
  if (isParent) {
    settlements.forEach(s => {
      const sid = s.studentId || 'unknown'
      if (!groupedSettlements[sid]) groupedSettlements[sid] = []
      groupedSettlements[sid].push(s)
    })
  }

  // No monthsForSelect needed

  return (
    <>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold">Rozliczenia miesięczne</h1>

        {isTutorOrAdmin && (
          <>
            <div className="mb-4">
              <Label htmlFor="student-select">Wybierz ucznia:</Label>
              <select
                id="student-select"
                value={selectedStudent}
                onChange={e => {
                  setSelectedStudent(e.target.value);
                  setEditingSettlements({});
                  fetchSettlements(e.target.value);
                }}
                className="mt-1 block w-full rounded border border-gray-300 bg-white p-2"
              >
                {students.map(student => (
                  <option key={student.id} value={student.id}>
                    {student.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <Label htmlFor="month-input">Wybierz miesiąc:</Label>
              <Input
                id="month-input"
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="mt-1 block w-full"
              />
            </div>
            <div className="mb-4">
              <Label>Zaplanowane godziny </Label>
              <Input type="number" value={plannedHours} onChange={e => setPlannedHours(Number(e.target.value))} />
            </div>
            <div className="mb-4">
              <Label>Dodatkowe godziny</Label>
              <Input type="number" value={completedHours} onChange={e => setCompletedHours(Number(e.target.value))} />
            </div>
            <div className="mb-4">
              <Label>Anulowane godziny</Label>
              <Input type="number" value={balance} onChange={e => setBalance(Number(e.target.value))} />
            </div>
            <div className="mb-4">
              <Label>Godziny przełożone na kolejny miesiąc</Label>
              <Input type="number" value={carriedOverHours} onChange={e => setCarriedOverHours(Number(e.target.value))} />
            </div>
            <div className="mb-4">
              <Label>Data płatności</Label>
              <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
            </div>
            <div className="mb-4">
              <Label>Komentarze</Label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                className="mt-1 block w-full rounded border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              />
            </div>
            <Button onClick={handleSaveSettlement}>Zapisz rozliczenie</Button>

            {/* Lista istniejących rozliczeń do edycji */}
            <div className="mt-10">
              <h2 className="text-xl font-semibold mb-4">Rozliczenia ucznia</h2>
              {settlements.length === 0 && <p>Brak rozliczeń dla wybranego ucznia.</p>}
              {settlements.map(settlement => {
                const edit = editingSettlements[settlement.id || ''] || {};
                return (
                  <Card key={settlement.id} className="mb-4">
                    <CardHeader>
                      <CardTitle>{settlement.month}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <details>
                        <summary>Szczegóły</summary>
                        <div className="mt-2 space-y-2">
                          <div>
                            <Label>Zaplanowane godziny </Label>
                            <Input
                              type="number"
                              value={edit.plannedHours !== undefined ? edit.plannedHours : settlement.plannedHours || 0}
                              onChange={e =>
                                handleEditSettlementField(settlement.id || '', 'plannedHours', Number(e.target.value))
                              }
                            />
                          </div>
                          <div>
                            <Label>Dodatkowe godziny</Label>
                            <Input
                              type="number"
                              value={edit.completedHours !== undefined ? edit.completedHours : settlement.completedHours || 0}
                              onChange={e =>
                                handleEditSettlementField(settlement.id || '', 'completedHours', Number(e.target.value))
                              }
                            />
                          </div>
                          <div>
                          <div>
                            <Label>Godziny przełożone na kolejny miesiąc</Label>
                            <Input
                              type="number"
                              value={edit.carriedOverHours !== undefined ? edit.carriedOverHours : settlement.carriedOverHours || 0}
                              onChange={e =>
                                handleEditSettlementField(settlement.id || '', 'carriedOverHours', Number(e.target.value))
                              }
                            />
                          </div>
                            <Label>Anulowane godziny</Label>
                            <Input
                              type="number"
                              value={edit.balance !== undefined ? edit.balance : settlement.balance || 0}
                              onChange={e =>
                                handleEditSettlementField(settlement.id || '', 'balance', Number(e.target.value))
                              }
                            />
                          </div>
                          <div>
                            <Label>Data płatności</Label>
                            <Input
                              type="date"
                              value={
                                typeof edit.paymentDate === 'string'
                                  ? edit.paymentDate
                                  : (typeof settlement.paymentDate === 'string'
                                    ? settlement.paymentDate
                                    : '')
                              }
                              onChange={e =>
                                handleEditSettlementField(settlement.id || '', 'paymentDate', e.target.value)
                              }
                            />
                          </div>
                          <div>
                            <Label>Komentarze</Label>
                            <textarea
                              value={edit.notes !== undefined ? edit.notes : settlement.notes || ''}
                              onChange={e =>
                                handleEditSettlementField(settlement.id || '', 'notes', e.target.value)
                              }
                              rows={3}
                              className="mt-1 block w-full rounded border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                            />
                          </div>
                          <Button
                            className="mt-2"
                            disabled={savingSettlements[settlement.id || '']}
                            onClick={() => {
                              // Only send changed fields — bez indeksowania dynamicznymi kluczami
                              const updatedFields: Partial<MonthlySettlement> = {};

                              if (edit.plannedHours !== undefined && edit.plannedHours !== (settlement.plannedHours ?? 0)) {
                                updatedFields.plannedHours = edit.plannedHours;
                              }
                              if (edit.completedHours !== undefined && edit.completedHours !== (settlement.completedHours ?? 0)) {
                                updatedFields.completedHours = edit.completedHours;
                              }
                              if (edit.balance !== undefined && edit.balance !== (settlement.balance ?? 0)) {
                                updatedFields.balance = edit.balance;
                              }
                              if (edit.carriedOverHours !== undefined && edit.carriedOverHours !== (settlement.carriedOverHours ?? 0)) {
                                updatedFields.carriedOverHours = edit.carriedOverHours;
                              }
                              if (typeof edit.paymentDate === 'string' && edit.paymentDate !== (settlement.paymentDate ?? '')) {
                                updatedFields.paymentDate = edit.paymentDate;
                              }
                              if (typeof edit.notes === 'string' && edit.notes !== (settlement.notes ?? '')) {
                                updatedFields.notes = edit.notes;
                              }

                              if (Object.keys(updatedFields).length === 0) {
                                alert('Brak zmian do zapisania.');
                                return;
                              }

                              handleUpdateSettlement(settlement.id || '', updatedFields);
                            }}
                          >
                            {savingSettlements[settlement.id || ''] ? 'Zapisywanie...' : 'Zapisz zmiany'}
                          </Button>
                        </div>
                      </details>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {(isStudent || isParent) && (
          <div className="space-y-6">
            {isStudent && (
              <>
                <h2 className="text-xl font-semibold">Twoje rozliczenia</h2>
                {settlements.length === 0 && <p>Brak rozliczeń.</p>}
                {settlements.map(settlement => (
                  <Card key={settlement.id}>
                    <CardHeader>
                      <CardTitle>{settlement.month}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <details>
                        <summary>Szczegóły</summary>
                        <div className="mt-2 space-y-1">
                          <p>Zaplanowane godziny: {settlement.plannedHours}</p>
                          <p>Dodatkowe godziny: {settlement.completedHours}</p>
                          <p>Anulowane godziny: {settlement.balance}</p>
                          <p>Godziny przełożone na kolejny miesiąc: {settlement.carriedOverHours ?? 0}</p>
                          {settlement.paymentDate && <p>Data płatności: {settlement.paymentDate}</p>}
                          {settlement.notes && <div className="whitespace-pre-line">Komentarze: {settlement.notes}</div>}
                        </div>
                      </details>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}

            {isParent && (
              <>
                <h2 className="text-xl font-semibold">Rozliczenia dzieci</h2>
                {Object.keys(groupedSettlements).length === 0 && <p>Brak rozliczeń.</p>}
                {Object.entries(groupedSettlements).map(([studentId, studentSettlements]) => {
                  // Prefer settlement.studentName if available, otherwise fallback to students[] or studentId
                  const studentName =
                    studentSettlements[0]?.studentName ||
                    students.find(s => s.id === studentId)?.fullName ||
                    studentId

                  return (
                    <div key={studentId}>
                      <h3 className="text-lg font-semibold mb-2">Uczeń: {studentName}</h3>
                      {studentSettlements.map(settlement => (
                        <Card key={settlement.id}>
                          <CardHeader>
                            <CardTitle>{settlement.month}</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <details>
                              <summary>Szczegóły</summary>
                              <div className="mt-2 space-y-1">
                                <p>Zaplanowane godziny: {settlement.plannedHours}</p>
                                <p>Dodatkowe godziny: {settlement.completedHours}</p>
                                <p>Anulowane godziny: {settlement.balance}</p>
                                <p>Godziny przełożone na kolejny miesiąc: {settlement.carriedOverHours ?? 0}</p>
                                {settlement.paymentDate && <p>Data płatności: {settlement.paymentDate}</p>}
                                {settlement.notes && <div className="whitespace-pre-line">Komentarze: {settlement.notes}</div>}
                              </div>
                            </details>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )
                })}
                {/* Łączne podsumowanie per miesiąc dla wszystkich dzieci */}
                {(() => {
                  // Build monthly summary for all settlements using planned, completed, balance, carriedOverHours
                  const monthlySummary: Record<string, { planned: number; completed: number; balance: number; carriedOverHours: number }> = {};
                  settlements.forEach(s => {
                    if (!s.month) return;
                    if (!monthlySummary[s.month]) {
                      monthlySummary[s.month] = { planned: 0, completed: 0, balance: 0, carriedOverHours: 0 };
                    }
                    monthlySummary[s.month].planned += Number(s.plannedHours) || 0;
                    monthlySummary[s.month].completed += Number(s.completedHours) || 0;
                    monthlySummary[s.month].balance += Number(s.balance) || 0;
                    monthlySummary[s.month].carriedOverHours += Number(s.carriedOverHours) || 0;
                  });
                  // Sort months descending
                  const sortedMonths = Object.keys(monthlySummary).sort((a, b) => b.localeCompare(a));
                  if (sortedMonths.length === 0) return null;
                  return (
                    <div className="mt-8">
                      <h3 className="text-lg font-bold mb-2">Podsumowanie łączne (wszystkie dzieci, per miesiąc)</h3>
                      {sortedMonths.map(month => (
                        <Card key={month} className="mb-2">
                          <CardHeader>
                            <CardTitle>{month}</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-1">
                            <p>Zaplanowane godziny: {monthlySummary[month].planned}</p>
                            <p>Dodatkowe godziny: {monthlySummary[month].completed}</p>
                            <p>Anulowane godziny: {monthlySummary[month].balance}</p>
                            <p>Godziny przełożone na kolejny miesiąc: {monthlySummary[month].carriedOverHours}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}