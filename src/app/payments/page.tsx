'use client'

import { useState, useEffect } from 'react'
import { db, auth } from '@/lib/firebase'
import { collection, getDocs, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface MonthlySettlement {
  id?: string
  month: string
  // Stare pola (zachowane dla historii)
  plannedHours?: number
  completedHours?: number
  balance?: number
  carriedOverHours?: number
  // Nowe pola 
  totalHours?: number
  travelCount?: number
  adjustmentAmount?: number
  calculatedTotal?: number
  // Zapisane historyczne stawki
  hourlyRate?: number
  travelRate?: number
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

interface ParentData {
  linkedAccounts?: { studentId?: string }[]
}

async function resolveChildrenIdsForParent(parentUid: string): Promise<string[]> {
  try {
    const parentDocSnap = await getDoc(doc(db, 'users', parentUid))
    if (!parentDocSnap.exists()) return []

    const parentData = parentDocSnap.data() as ParentData
    const linkedAccounts = Array.isArray(parentData.linkedAccounts) ? parentData.linkedAccounts : []

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
  const [isLoading, setIsLoading] = useState(true)
  
  const [students, setStudents] = useState<{ id: string; fullName: string; hourlyRate: number; travelRate: number }[]>([])
  const [selectedStudent, setSelectedStudent] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [settlements, setSettlements] = useState<MonthlySettlement[]>([])
  
  // Stany formularza 
  const [totalHours, setTotalHours] = useState<number | ''>('')
  const [travelCount, setTravelCount] = useState<number | ''>('')
  const [adjustmentAmount, setAdjustmentAmount] = useState<number | ''>('')
  
  const [paymentDate, setPaymentDate] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  
  const [editingSettlements, setEditingSettlements] = useState<Record<string, Partial<MonthlySettlement>>>({})
  const [savingSettlements, setSavingSettlements] = useState<Record<string, boolean>>({})
  const [isEditingSettlements, setIsEditingSettlements] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const usersSnap = await getDocs(collection(db, 'users'))
          const userDoc = usersSnap.docs.find(doc => doc.id === user.uid)
          const accountType = userDoc?.data().accountType || ''
          const childrenIds = userDoc?.data().childrenIds || []
          
          if (accountType === 'tutor' || accountType === 'admin') {
            setCurrentUser({ id: user.uid, accountType, childrenIds })
            const studentsList = usersSnap.docs
              .filter(doc => doc.data().accountType === 'student')
              .map(doc => {
                const data = doc.data()
                const fullName = data.name || ((data.firstName || '') + ' ' + (data.lastName || '')).trim() || doc.id
                return { 
                  id: doc.id, 
                  fullName, 
                  hourlyRate: Number(data.hourlyRate) || 0,
                  travelRate: Number(data.travelRate) || 0 
                }
              })
            setStudents(studentsList)
            if (studentsList.length > 0) setSelectedStudent(studentsList[0].id)
          } else if (accountType === 'student') {
            setCurrentUser({ id: user.uid, accountType, childrenIds })
            setSelectedStudent(user.uid)
            await fetchSettlements(user.uid)
          } else if (accountType === 'parent') {
            const resolvedChildren = await resolveChildrenIdsForParent(user.uid)
            setCurrentUser({ id: user.uid, accountType, childrenIds: resolvedChildren })
            setSelectedStudent('')
            await fetchSettlementsForParent(resolvedChildren)
          }
        } catch (error) {
           console.error("Błąd podczas ładowania:", error)
        } finally {
          setIsLoading(false)
        }
      } else {
        setCurrentUser(null)
        setStudents([])
        setSelectedStudent('')
        setSelectedMonth('')
        setSettlements([])
        setIsLoading(false)
        window.location.href = '/auth/login'
      }
    })
    return () => unsubscribe()
  }, [])

  const fetchSettlements = async (studentId: string) => {
    if (!studentId) return
    
    // Pobierz aktualne stawki ucznia w razie gdyby rozliczenie nie miało ich zapisanych historycznie
    const userDocRef = doc(db, 'users', studentId)
    const userDocSnap = await getDoc(userDocRef)
    const udata = userDocSnap.exists() ? userDocSnap.data() : {}
    const fallbackHourly = Number(udata.hourlyRate) || 0;
    const fallbackTravel = Number(udata.travelRate) || 0;

    const settlementsRef = collection(db, 'users', studentId, 'monthlySettlements')
    const snap = await getDocs(settlementsRef)
    let data = snap.docs.map(doc => {
      const d = doc.data()
      return {
        id: doc.id,
        studentId,
        ...d,
        hourlyRate: d.hourlyRate !== undefined ? d.hourlyRate : fallbackHourly,
        travelRate: d.travelRate !== undefined ? d.travelRate : fallbackTravel,
      } as MonthlySettlement
    })
    
    const uniqueMap = new Map<string, MonthlySettlement>()
    data.forEach(s => {
      const key = `${s.studentId}-${s.month}`
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, s)
      }
    })
    data = Array.from(uniqueMap.values())
    data.sort((a, b) => (b.month > a.month ? 1 : b.month < a.month ? -1 : 0))
    setSettlements(data)
  }

  const fetchSettlementsForParent = async (childrenIds: string[]) => {
    let allSettlements: MonthlySettlement[] = []
    for (const childId of childrenIds) {
      let studentName = childId
      let fallbackHourly = 0;
      let fallbackTravel = 0;
      try {
        const userDocRef = doc(db, 'users', childId)
        const userDocSnap = await getDoc(userDocRef)
        if (userDocSnap.exists()) {
          const udata = userDocSnap.data()
          studentName = udata.name || [udata.firstName, udata.lastName].filter(Boolean).join(' ').trim() || childId
          fallbackHourly = Number(udata.hourlyRate) || 0;
          fallbackTravel = Number(udata.travelRate) || 0;
        }
      } catch {
        // fallback
      }
      const settlementsRef = collection(db, 'users', childId, 'monthlySettlements')
      const snap = await getDocs(settlementsRef)
      const childSettlements = snap.docs.map(doc => {
        const d = doc.data()
        return {
          id: doc.id,
          studentId: childId,
          ...d,
          hourlyRate: d.hourlyRate !== undefined ? d.hourlyRate : fallbackHourly,
          travelRate: d.travelRate !== undefined ? d.travelRate : fallbackTravel,
          studentName,
        } as MonthlySettlement
      })
      allSettlements = allSettlements.concat(childSettlements)
    }
    const uniqueMap = new Map<string, MonthlySettlement>()
    allSettlements.forEach(s => {
      const key = `${s.studentId}-${s.month}`
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, s)
      }
    })
    allSettlements = Array.from(uniqueMap.values())
    allSettlements.sort((a, b) => (b.month > a.month ? 1 : b.month < a.month ? -1 : 0))
    setSettlements(allSettlements)
  }

  const selectedStudentData = students.find(s => s.id === selectedStudent)
  const currentHourlyRate = selectedStudentData?.hourlyRate || 0
  const currentTravelRate = selectedStudentData?.travelRate || 0

  const parsedHours = typeof totalHours === 'number' ? totalHours : 0;
  const parsedTravels = currentTravelRate > 0 ? (typeof travelCount === 'number' ? travelCount : 0) : 0;
  const parsedAdj = typeof adjustmentAmount === 'number' ? adjustmentAmount : 0;

  const calculatedTotalAmount = (parsedHours * currentHourlyRate) + (parsedTravels * currentTravelRate) + parsedAdj

  const handleSaveSettlement = async () => {
    try {
      if (!selectedStudent) {
        alert('Wybierz ucznia przed zapisaniem rozliczenia.');
        return;
      }
      if (!selectedMonth) {
        alert('Wybierz miesiąc przed zapisaniem rozliczenia.');
        return;
      }
      
      const settlementsRef = collection(db, 'users', selectedStudent, 'monthlySettlements');
      const settlementData: Omit<MonthlySettlement, "id"> & { createdAt: string; createdBy: string } = {
        studentId: selectedStudent,
        month: selectedMonth,
        totalHours: parsedHours,
        travelCount: parsedTravels,
        adjustmentAmount: parsedAdj,
        calculatedTotal: calculatedTotalAmount,
        hourlyRate: currentHourlyRate,
        travelRate: currentTravelRate,
        notes: notes,
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.id || ''
      };
      
      if (paymentDate) {
        settlementData.paymentDate = paymentDate;
      }
      
      await addDoc(settlementsRef, settlementData);
      
      setTotalHours('');
      setTravelCount('');
      setAdjustmentAmount('');
      setPaymentDate('');
      setNotes('');
      
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

  const handleEditSettlementField = (settlementId: string, field: keyof MonthlySettlement, value: string | number) => {
    setEditingSettlements(prev => ({
      ...prev,
      [settlementId]: {
        ...prev[settlementId],
        [field]: value,
      }
    }));
  };

  const handleUpdateSettlement = async (settlementId: string, updatedData: Partial<MonthlySettlement>) => {
    if (!selectedStudent || !settlementId) return;
    setSavingSettlements(prev => ({ ...prev, [settlementId]: true }));
    try {
      const currentSettle = settlements.find(s => s.id === settlementId)
      const tHours = updatedData.totalHours !== undefined ? updatedData.totalHours : (currentSettle?.totalHours || 0)
      const tCount = updatedData.travelCount !== undefined ? updatedData.travelCount : (currentSettle?.travelCount || 0)
      const adj = updatedData.adjustmentAmount !== undefined ? updatedData.adjustmentAmount : (currentSettle?.adjustmentAmount || 0)
      
      // Do wyliczeń po edycji używaj stawek historycznych zapisanych w rozliczeniu
      const hRate = currentSettle?.hourlyRate || currentHourlyRate || 0;
      const tRate = currentSettle?.travelRate || currentTravelRate || 0;

      if (updatedData.totalHours !== undefined || updatedData.travelCount !== undefined || updatedData.adjustmentAmount !== undefined) {
          updatedData.calculatedTotal = (tHours * hRate) + (tCount * tRate) + adj;
      }

      await updateDoc(doc(db, 'users', selectedStudent, 'monthlySettlements', settlementId), updatedData);
      await fetchSettlements(selectedStudent);
      
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

  if (isLoading) {
    return <p className="p-4">Ładowanie...</p>
  }

  if (!currentUser) {
    return null
  }

  const isTutorOrAdmin = currentUser?.accountType === 'tutor' || currentUser?.accountType === 'admin'
  const isStudent = currentUser?.accountType === 'student'
  const isParent = currentUser?.accountType === 'parent'

  const groupedSettlements: Record<string, MonthlySettlement[]> = {}
  if (isParent) {
    settlements.forEach(s => {
      const sid = s.studentId || 'unknown'
      if (!groupedSettlements[sid]) groupedSettlements[sid] = []
      groupedSettlements[sid].push(s)
    })
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold mb-6">Rozliczenia miesięczne</h1>

      {isTutorOrAdmin && (
        <div className="space-y-6">
          {/* GÓRNA KARTA: FORMULARZ */}
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Nowe rozliczenie</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              
              <Label>Uczeń</Label>
              <Select 
                value={selectedStudent} 
                onValueChange={(val) => {
                  setSelectedStudent(val);
                  setEditingSettlements({});
                  fetchSettlements(val);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz ucznia" />
                </SelectTrigger>
                <SelectContent>
                  {students.map(student => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Label>Miesiąc i rok</Label>
              <Input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
              />

              <Label>Liczba godzin</Label>
              <Input 
                type="number" 
                min="0" 
                step="0.5"
                value={totalHours} 
                onChange={e => setTotalHours(e.target.value === '' ? '' : Number(e.target.value))} 
              />

              {currentTravelRate > 0 && (
                <>
                  <Label>Liczba dojazdów</Label>
                  <Input 
                    type="number" 
                    min="0" 
                    value={travelCount} 
                    onChange={e => setTravelCount(e.target.value === '' ? '' : Number(e.target.value))} 
                  />
                </>
              )}

              <Label>Korekta (zł) (+/-)</Label>
              <Input 
                type="number" 
                value={adjustmentAmount} 
                onChange={e => setAdjustmentAmount(e.target.value === '' ? '' : Number(e.target.value))} 
                placeholder="np. -50 lub 100"
              />

              <Label>Data płatności</Label>
              <Input 
                type="date" 
                value={paymentDate} 
                onChange={e => setPaymentDate(e.target.value)} 
              />
              
              <Label>Komentarze</Label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[80px]"
              />
              
              <Alert>
                <AlertDescription className="text-sm font-medium">
                  Lekcje: {parsedHours} godz. × {currentHourlyRate} zł = {parsedHours * currentHourlyRate} zł
                  {currentTravelRate > 0 && (
                    <><br/>Dojazdy: {parsedTravels} × {currentTravelRate} zł = {parsedTravels * currentTravelRate} zł</>
                  )}
                  {parsedAdj !== 0 && (
                    <><br/>Korekta: {parsedAdj > 0 ? '+' : ''}{parsedAdj} zł</>
                  )}
                  <span className="font-bold text-lg block mt-2 pt-2 border-t border-gray-300">Razem do zapłaty: {calculatedTotalAmount} zł</span>
                </AlertDescription>
              </Alert>

              <Button onClick={handleSaveSettlement}>Zapisz rozliczenie</Button>
            </CardContent>
          </Card>

          {/* DOLNA KARTA: HISTORIA */}
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Historia rozliczeń</CardTitle>
            </CardHeader>
            <CardContent>
              {settlements.length === 0 && <p className="text-sm text-gray-500">Brak rozliczeń dla wybranego ucznia.</p>}
              
              <ul className="space-y-4">
                {settlements.map(settlement => {
                  const edit = editingSettlements[settlement.id || ''] || {};
                  const isEditing = isEditingSettlements[settlement.id || ''] || false;
                  
                  return (
                    <li key={settlement.id} className="border rounded-md p-4 bg-white">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-semibold">{settlement.month}</h3>
                        {settlement.calculatedTotal !== undefined && (
                          <span className="font-bold text-lg">{settlement.calculatedTotal} zł</span>
                        )}
                      </div>
                      
                      <details>
                        <summary className="cursor-pointer font-medium text-sm">Szczegóły</summary>
                        <div className="mt-4 space-y-4 text-sm text-gray-800">
                          {!isEditing ? (
                            <>
                              {settlement.totalHours !== undefined && (
                                <p>Liczba godzin: {settlement.totalHours} godz. × {settlement.hourlyRate || 0} zł = {settlement.totalHours * (settlement.hourlyRate || 0)} zł</p>
                              )}
                              
                              {!!settlement.travelCount && settlement.travelCount > 0 && (
                                <p>Liczba dojazdów: {settlement.travelCount} × {settlement.travelRate || 0} zł = {settlement.travelCount * (settlement.travelRate || 0)} zł</p>
                              )}
                              
                              {settlement.adjustmentAmount !== undefined && settlement.adjustmentAmount !== 0 && (
                                <p>Korekta: {settlement.adjustmentAmount > 0 ? '+' : ''}{settlement.adjustmentAmount} zł</p>
                              )}
                              
                              {settlement.plannedHours !== undefined && settlement.totalHours === undefined && (
                                <p>Zaplanowane godziny (Stary system): {settlement.plannedHours}</p>
                              )}
                              
                              {settlement.calculatedTotal !== undefined && (
                                <p className="font-semibold pt-2 border-t border-gray-200 mt-2">Razem do zapłaty: {settlement.calculatedTotal} zł</p>
                              )}
                              
                              <p className="mt-2 text-gray-600">Data płatności: {settlement.paymentDate ? settlement.paymentDate : '-'}</p>
                              
                              <div className="mt-2 text-gray-600">
                                Komentarze:<br/>
                                <span className="whitespace-pre-line text-gray-800">{settlement.notes ? settlement.notes : '-'}</span>
                              </div>
                              
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-4"
                                onClick={() => {
                                  setIsEditingSettlements(prev => ({ ...prev, [settlement.id || '']: true }));
                                  setEditingSettlements(prev => ({
                                    ...prev,
                                    [settlement.id || '']: {
                                      totalHours: settlement.totalHours ?? 0,
                                      travelCount: settlement.travelCount ?? 0,
                                      adjustmentAmount: settlement.adjustmentAmount ?? 0,
                                      paymentDate: settlement.paymentDate ?? '',
                                      notes: settlement.notes ?? '',
                                    },
                                  }));
                                }}
                              >
                                Edytuj
                              </Button>
                            </>
                          ) : (
                            <div className="space-y-4">
                              <div>
                                <Label>Liczba godzin</Label>
                                <Input type="number" step="0.5" value={edit.totalHours ?? 0} onChange={e => handleEditSettlementField(settlement.id || '', 'totalHours', Number(e.target.value))} />
                              </div>
                              
                              {(currentTravelRate > 0 || (edit.travelCount && edit.travelCount > 0)) && (
                                <div>
                                  <Label>Liczba dojazdów</Label>
                                  <Input type="number" value={edit.travelCount ?? 0} onChange={e => handleEditSettlementField(settlement.id || '', 'travelCount', Number(e.target.value))} />
                                </div>
                              )}

                              <div>
                                <Label>Korekta (zł)</Label>
                                <Input type="number" value={edit.adjustmentAmount ?? 0} onChange={e => handleEditSettlementField(settlement.id || '', 'adjustmentAmount', Number(e.target.value))} />
                              </div>
                              <div>
                                <Label>Data płatności</Label>
                                <Input type="date" value={typeof edit.paymentDate === 'string' ? edit.paymentDate : (typeof settlement.paymentDate === 'string' ? settlement.paymentDate : '')} onChange={e => handleEditSettlementField(settlement.id || '', 'paymentDate', e.target.value)} />
                              </div>
                              <div>
                                <Label>Komentarze</Label>
                                <textarea value={edit.notes !== undefined ? edit.notes : settlement.notes || ''} onChange={e => handleEditSettlementField(settlement.id || '', 'notes', e.target.value)} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[60px]" />
                              </div>
                              <div className="flex gap-2 mt-4">
                                <Button
                                  size="sm"
                                  disabled={savingSettlements[settlement.id || '']}
                                  onClick={() => {
                                    const updatedFields: Partial<MonthlySettlement> = {};
                                    if (edit.totalHours !== undefined && edit.totalHours !== (settlement.totalHours ?? 0)) updatedFields.totalHours = edit.totalHours;
                                    if (edit.travelCount !== undefined && edit.travelCount !== (settlement.travelCount ?? 0)) updatedFields.travelCount = edit.travelCount;
                                    if (edit.adjustmentAmount !== undefined && edit.adjustmentAmount !== (settlement.adjustmentAmount ?? 0)) updatedFields.adjustmentAmount = edit.adjustmentAmount;
                                    if (typeof edit.paymentDate === 'string' && edit.paymentDate !== (settlement.paymentDate ?? '')) updatedFields.paymentDate = edit.paymentDate;
                                    if (typeof edit.notes === 'string' && edit.notes !== (settlement.notes ?? '')) updatedFields.notes = edit.notes;
                                    
                                    if (Object.keys(updatedFields).length === 0) {
                                      setIsEditingSettlements(prev => ({...prev, [settlement.id || '']: false}));
                                      return;
                                    }
                                    handleUpdateSettlement(settlement.id || '', updatedFields);
                                  }}
                                >
                                  {savingSettlements[settlement.id || ''] ? 'Zapisywanie...' : 'Zapisz'}
                                </Button>
                                <Button variant="secondary" size="sm" type="button" onClick={() => setIsEditingSettlements(prev => ({...prev, [settlement.id || '']: false}))}>Anuluj</Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {}
      {(isStudent || isParent) && (
        <div className="space-y-6">
          {isStudent && (
            <Card>
              <CardHeader>
                <CardTitle>Twoje rozliczenia</CardTitle>
              </CardHeader>
              <CardContent>
                {settlements.length === 0 && <p className="text-gray-500 italic">Brak rozliczeń.</p>}
                <ul className="space-y-4">
                  {settlements.map(settlement => (
                    <li key={settlement.id} className="border rounded p-4">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-semibold">{settlement.month}</h3>
                        {settlement.calculatedTotal !== undefined && <span className="font-bold text-lg">{settlement.calculatedTotal} zł</span>}
                      </div>
                      <details>
                        <summary className="cursor-pointer font-medium text-sm">Szczegóły</summary>
                        <div className="mt-4 space-y-1 text-sm text-gray-800">
                          {settlement.totalHours !== undefined && (
                            <p>Liczba godzin: {settlement.totalHours} godz. × {settlement.hourlyRate || 0} zł = {settlement.totalHours * (settlement.hourlyRate || 0)} zł</p>
                          )}
                          
                          {!!settlement.travelCount && settlement.travelCount > 0 && (
                            <p>Liczba dojazdów: {settlement.travelCount} × {settlement.travelRate || 0} zł = {settlement.travelCount * (settlement.travelRate || 0)} zł</p>
                          )}
                          
                          {settlement.adjustmentAmount !== undefined && settlement.adjustmentAmount !== 0 && (
                            <p>Korekta: {settlement.adjustmentAmount > 0 ? '+' : ''}{settlement.adjustmentAmount} zł</p>
                          )}

                          {settlement.calculatedTotal !== undefined && (
                            <p className="font-semibold pt-2 border-t border-gray-200 mt-2">Razem do zapłaty: {settlement.calculatedTotal} zł</p>
                          )}
                          
                          {settlement.paymentDate && <p className="mt-2 text-gray-600">Data płatności: {settlement.paymentDate}</p>}
                          
                          {settlement.notes && (
                            <div className="mt-2 text-gray-600">
                              Komentarze:<br/>
                              <span className="whitespace-pre-line text-gray-800">{settlement.notes}</span>
                            </div>
                          )}
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {isParent && (
            <Card>
              <CardHeader>
                <CardTitle>Rozliczenia dzieci</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(groupedSettlements).length === 0 && <p className="text-gray-500 italic">Brak rozliczeń.</p>}
                <div className="space-y-6">
                  {Object.entries(groupedSettlements).map(([studentId, studentSettlements]) => {
                    const studentName = studentSettlements[0]?.studentName || students.find(s => s.id === studentId)?.fullName || studentId
                    return (
                      <div key={studentId} className="border-b pb-6 last:border-b-0">
                        <h3 className="text-xl font-semibold mb-4">Uczeń: {studentName}</h3>
                        <ul className="space-y-4">
                          {studentSettlements.map(settlement => (
                            <li key={settlement.id} className="border rounded p-4">
                              <div className="flex justify-between items-center mb-2">
                                <h4 className="text-lg font-semibold">{settlement.month}</h4>
                                {settlement.calculatedTotal !== undefined && <span className="font-bold text-lg">{settlement.calculatedTotal} zł</span>}
                              </div>
                              <details>
                                <summary className="cursor-pointer font-medium text-sm">Szczegóły</summary>
                                <div className="mt-4 space-y-1 text-sm text-gray-800">
                                  {settlement.totalHours !== undefined && (
                                    <p>Liczba godzin: {settlement.totalHours} godz. × {settlement.hourlyRate || 0} zł = {settlement.totalHours * (settlement.hourlyRate || 0)} zł</p>
                                  )}
                                  
                                  {!!settlement.travelCount && settlement.travelCount > 0 && (
                                    <p>Liczba dojazdów: {settlement.travelCount} × {settlement.travelRate || 0} zł = {settlement.travelCount * (settlement.travelRate || 0)} zł</p>
                                  )}
                                  
                                  {settlement.adjustmentAmount !== undefined && settlement.adjustmentAmount !== 0 && (
                                    <p>Korekta: {settlement.adjustmentAmount > 0 ? '+' : ''}{settlement.adjustmentAmount} zł</p>
                                  )}

                                  {settlement.calculatedTotal !== undefined && (
                                    <p className="font-semibold pt-2 border-t border-gray-200 mt-2">Razem do zapłaty: {settlement.calculatedTotal} zł</p>
                                  )}
                                  
                                  {settlement.paymentDate && <p className="mt-2 text-gray-600">Data płatności: {settlement.paymentDate}</p>}
                                  
                                  {settlement.notes && (
                                    <div className="mt-2 text-gray-600">
                                      Komentarze:<br/>
                                      <span className="whitespace-pre-line text-gray-800">{settlement.notes}</span>
                                    </div>
                                  )}
                                </div>
                              </details>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}