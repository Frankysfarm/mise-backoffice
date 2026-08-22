'use client'

import { useState } from 'react'
import { Settings, Printer, defaultSettings, printerTypes, paperWidths } from '@/lib/lieferdienst/settings'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Settings as SettingsIcon, 
  Printer as PrinterIcon, 
  Volume2, 
  Monitor, 
  Bell, 
  Store,
  Plus,
  Trash2,
  Wifi,
  WifiOff,
  RefreshCw,
  Check,
  X
} from 'lucide-react'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: Settings
  onSave: (settings: Settings) => void
}

export function SettingsDialog({ open, onOpenChange, settings, onSave }: SettingsDialogProps) {
  const [localSettings, setLocalSettings] = useState<Settings>(settings)
  const [testingPrinter, setTestingPrinter] = useState<string | null>(null)
  const [addingPrinter, setAddingPrinter] = useState(false)
  const [newPrinter, setNewPrinter] = useState<Partial<Printer>>({
    name: '',
    type: 'kitchen',
    ipAddress: '',
    port: 9100,
    paperWidth: 80,
    autoPrint: true,
    printCopies: 1,
  })

  const handleSave = () => {
    onSave(localSettings)
    onOpenChange(false)
  }

  const handleAddPrinter = () => {
    if (newPrinter.name && newPrinter.ipAddress) {
      const printer: Printer = {
        id: `printer-${Date.now()}`,
        name: newPrinter.name,
        type: newPrinter.type as 'receipt' | 'kitchen' | 'label',
        ipAddress: newPrinter.ipAddress,
        port: newPrinter.port || 9100,
        connected: false,
        paperWidth: newPrinter.paperWidth as 58 | 80,
        autoPrint: newPrinter.autoPrint ?? true,
        printCopies: newPrinter.printCopies || 1,
      }
      setLocalSettings(prev => ({
        ...prev,
        printers: [...prev.printers, printer],
      }))
      setNewPrinter({
        name: '',
        type: 'kitchen',
        ipAddress: '',
        port: 9100,
        paperWidth: 80,
        autoPrint: true,
        printCopies: 1,
      })
      setAddingPrinter(false)
    }
  }

  const handleRemovePrinter = (id: string) => {
    setLocalSettings(prev => ({
      ...prev,
      printers: prev.printers.filter(p => p.id !== id),
    }))
  }

  const handleTestPrinter = async (id: string) => {
    setTestingPrinter(id)
    // Simulate printer test
    await new Promise(resolve => setTimeout(resolve, 2000))
    setLocalSettings(prev => ({
      ...prev,
      printers: prev.printers.map(p => 
        p.id === id ? { ...p, connected: true } : p
      ),
    }))
    setTestingPrinter(null)
  }

  const handleUpdatePrinter = (id: string, updates: Partial<Printer>) => {
    setLocalSettings(prev => ({
      ...prev,
      printers: prev.printers.map(p => 
        p.id === id ? { ...p, ...updates } : p
      ),
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border border-stone-200 rounded-2xl max-w-3xl p-0 overflow-hidden max-h-[90vh]">
        <div className="bg-gradient-to-r from-char to-charcoal px-6 py-5">
          <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
            <SettingsIcon className="w-6 h-6" />
            Einstellungen
          </DialogTitle>
          <DialogDescription className="text-white/70 mt-1">
            System-, Drucker- und Anzeigeeinstellungen konfigurieren
          </DialogDescription>
        </div>

        <Tabs defaultValue="printers" className="flex-1">
          <div className="border-b border-stone-200 px-6">
            <TabsList className="h-14 bg-transparent gap-1 p-0">
              <TabsTrigger 
                value="printers" 
                className="data-[state=active]:bg-saffron/10 data-[state=active]:text-saffron rounded-t-xl rounded-b-none border-b-2 border-transparent data-[state=active]:border-saffron px-4 py-3 gap-2"
              >
                <PrinterIcon className="w-4 h-4" />
                Drucker
              </TabsTrigger>
              <TabsTrigger 
                value="sound"
                className="data-[state=active]:bg-saffron/10 data-[state=active]:text-saffron rounded-t-xl rounded-b-none border-b-2 border-transparent data-[state=active]:border-saffron px-4 py-3 gap-2"
              >
                <Volume2 className="w-4 h-4" />
                Sound
              </TabsTrigger>
              <TabsTrigger 
                value="display"
                className="data-[state=active]:bg-saffron/10 data-[state=active]:text-saffron rounded-t-xl rounded-b-none border-b-2 border-transparent data-[state=active]:border-saffron px-4 py-3 gap-2"
              >
                <Monitor className="w-4 h-4" />
                Anzeige
              </TabsTrigger>
              <TabsTrigger 
                value="notifications"
                className="data-[state=active]:bg-saffron/10 data-[state=active]:text-saffron rounded-t-xl rounded-b-none border-b-2 border-transparent data-[state=active]:border-saffron px-4 py-3 gap-2"
              >
                <Bell className="w-4 h-4" />
                Benachrichtigungen
              </TabsTrigger>
              <TabsTrigger 
                value="store"
                className="data-[state=active]:bg-saffron/10 data-[state=active]:text-saffron rounded-t-xl rounded-b-none border-b-2 border-transparent data-[state=active]:border-saffron px-4 py-3 gap-2"
              >
                <Store className="w-4 h-4" />
                Restaurant
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-6 overflow-y-auto max-h-[50vh]">
            {/* Printers Tab */}
            <TabsContent value="printers" className="mt-0 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-char">Drucker verwalten</h3>
                  <p className="text-sm text-steel">Küchen-, Bon- und Etikettendrucker einrichten</p>
                </div>
                <Button
                  onClick={() => setAddingPrinter(true)}
                  className="bg-saffron hover:bg-saffron-deep text-white rounded-xl gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Drucker hinzufügen
                </Button>
              </div>

              {/* Add Printer Form */}
              {addingPrinter && (
                <div className="bg-stone-50 rounded-xl p-5 border border-stone-200 space-y-4">
                  <h4 className="font-semibold text-char">Neuen Drucker hinzufügen</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-char">Name</Label>
                      <Input
                        value={newPrinter.name}
                        onChange={e => setNewPrinter(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="z.B. Küche Hauptdrucker"
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-char">Typ</Label>
                      <Select 
                        value={newPrinter.type}
                        onValueChange={value => setNewPrinter(prev => ({ ...prev, type: value as Printer['type'] }))}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {printerTypes.map(t => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-char">IP-Adresse</Label>
                      <Input
                        value={newPrinter.ipAddress}
                        onChange={e => setNewPrinter(prev => ({ ...prev, ipAddress: e.target.value }))}
                        placeholder="192.168.1.100"
                        className="rounded-xl font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-char">Port</Label>
                      <Input
                        type="number"
                        value={newPrinter.port}
                        onChange={e => setNewPrinter(prev => ({ ...prev, port: parseInt(e.target.value) }))}
                        placeholder="9100"
                        className="rounded-xl font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-char">Papierbreite</Label>
                      <Select 
                        value={String(newPrinter.paperWidth)}
                        onValueChange={value => setNewPrinter(prev => ({ ...prev, paperWidth: parseInt(value) as 58 | 80 }))}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {paperWidths.map(w => (
                            <SelectItem key={w.value} value={String(w.value)}>{w.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-char">Kopien</Label>
                      <Input
                        type="number"
                        min={1}
                        max={5}
                        value={newPrinter.printCopies}
                        onChange={e => setNewPrinter(prev => ({ ...prev, printCopies: parseInt(e.target.value) }))}
                        className="rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                      <Switch 
                        checked={newPrinter.autoPrint}
                        onCheckedChange={checked => setNewPrinter(prev => ({ ...prev, autoPrint: checked }))}
                      />
                      <Label className="text-sm text-steel">Automatisch drucken bei neuer Bestellung</Label>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setAddingPrinter(false)} className="rounded-xl">
                        Abbrechen
                      </Button>
                      <Button 
                        onClick={handleAddPrinter}
                        disabled={!newPrinter.name || !newPrinter.ipAddress}
                        className="bg-saffron hover:bg-saffron-deep text-white rounded-xl"
                      >
                        Hinzufügen
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Printer List */}
              {localSettings.printers.length === 0 && !addingPrinter ? (
                <div className="text-center py-12 bg-stone-50 rounded-xl border border-dashed border-stone-300">
                  <PrinterIcon className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                  <p className="text-steel">Keine Drucker konfiguriert</p>
                  <p className="text-sm text-mist">Klicke auf &quot;Drucker hinzufügen&quot; um zu starten</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {localSettings.printers.map(printer => (
                    <div 
                      key={printer.id}
                      className="bg-white rounded-xl border border-stone-200 p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            printer.connected ? 'bg-emerald-100' : 'bg-stone-100'
                          }`}>
                            <PrinterIcon className={`w-6 h-6 ${
                              printer.connected ? 'text-emerald-600' : 'text-stone-400'
                            }`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-char">{printer.name}</h4>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                printer.type === 'kitchen' ? 'bg-saffron/10 text-saffron' :
                                printer.type === 'receipt' ? 'bg-emerald-100 text-emerald-700' :
                                'bg-blue-100 text-blue-700'
                              }`}>
                                {printerTypes.find(t => t.value === printer.type)?.label}
                              </span>
                            </div>
                            <p className="text-sm text-steel font-mono">{printer.ipAddress}:{printer.port}</p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-mist">
                              <span>Papier: {printer.paperWidth}mm</span>
                              <span>Kopien: {printer.printCopies}</span>
                              {printer.autoPrint && <span className="text-emerald-600">Auto-Druck aktiv</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg ${
                            printer.connected 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : 'bg-stone-100 text-stone-500'
                          }`}>
                            {printer.connected ? (
                              <>
                                <Wifi className="w-4 h-4" />
                                Verbunden
                              </>
                            ) : (
                              <>
                                <WifiOff className="w-4 h-4" />
                                Offline
                              </>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTestPrinter(printer.id)}
                            disabled={testingPrinter === printer.id}
                            className="rounded-lg gap-1"
                          >
                            {testingPrinter === printer.id ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4" />
                            )}
                            Test
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemovePrinter(printer.id)}
                            className="rounded-lg text-red-500 hover:bg-red-50 hover:text-red-600 border-red-200"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Sound Tab */}
            <TabsContent value="sound" className="mt-0 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-char mb-1">Sound-Einstellungen</h3>
                <p className="text-sm text-steel">Lautstärke und Benachrichtigungstöne anpassen</p>
              </div>

              <div className="flex items-center justify-between p-4 bg-stone-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Volume2 className="w-5 h-5 text-saffron" />
                  <div>
                    <p className="font-medium text-char">Sounds aktivieren</p>
                    <p className="text-sm text-steel">Alle Benachrichtigungstöne ein/ausschalten</p>
                  </div>
                </div>
                <Switch 
                  checked={localSettings.sound.enabled}
                  onCheckedChange={checked => setLocalSettings(prev => ({
                    ...prev,
                    sound: { ...prev.sound, enabled: checked }
                  }))}
                />
              </div>

              <div className="space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-char">Neue Bestellung</Label>
                    <span className="text-sm text-steel font-mono">{localSettings.sound.newOrderVolume}%</span>
                  </div>
                  <Slider
                    value={[localSettings.sound.newOrderVolume]}
                    max={100}
                    step={5}
                    onValueChange={([value]) => setLocalSettings(prev => ({
                      ...prev,
                      sound: { ...prev.sound, newOrderVolume: value }
                    }))}
                    className="w-full"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-char">Kunde anrufen</Label>
                    <span className="text-sm text-steel font-mono">{localSettings.sound.callCustomerVolume}%</span>
                  </div>
                  <Slider
                    value={[localSettings.sound.callCustomerVolume]}
                    max={100}
                    step={5}
                    onValueChange={([value]) => setLocalSettings(prev => ({
                      ...prev,
                      sound: { ...prev.sound, callCustomerVolume: value }
                    }))}
                    className="w-full"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-char">Bestellung fertig</Label>
                    <span className="text-sm text-steel font-mono">{localSettings.sound.orderReadyVolume}%</span>
                  </div>
                  <Slider
                    value={[localSettings.sound.orderReadyVolume]}
                    max={100}
                    step={5}
                    onValueChange={([value]) => setLocalSettings(prev => ({
                      ...prev,
                      sound: { ...prev.sound, orderReadyVolume: value }
                    }))}
                    className="w-full"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-char">Warnung / Stornierung</Label>
                    <span className="text-sm text-steel font-mono">{localSettings.sound.warningVolume}%</span>
                  </div>
                  <Slider
                    value={[localSettings.sound.warningVolume]}
                    max={100}
                    step={5}
                    onValueChange={([value]) => setLocalSettings(prev => ({
                      ...prev,
                      sound: { ...prev.sound, warningVolume: value }
                    }))}
                    className="w-full"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Display Tab */}
            <TabsContent value="display" className="mt-0 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-char mb-1">Anzeige-Einstellungen</h3>
                <p className="text-sm text-steel">Layout und Darstellung anpassen</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-char">Spaltenanzahl im Grid</Label>
                  <Select 
                    value={String(localSettings.display.gridColumns)}
                    onValueChange={value => setLocalSettings(prev => ({
                      ...prev,
                      display: { ...prev.display, gridColumns: parseInt(value) as 3 | 4 | 5 | 6 }
                    }))}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 Spalten</SelectItem>
                      <SelectItem value="4">4 Spalten</SelectItem>
                      <SelectItem value="5">5 Spalten</SelectItem>
                      <SelectItem value="6">6 Spalten</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-char">Sortierung</Label>
                  <Select 
                    value={localSettings.display.sortBy}
                    onValueChange={value => setLocalSettings(prev => ({
                      ...prev,
                      display: { ...prev.display, sortBy: value as 'time' | 'priority' | 'type' }
                    }))}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="time">Nach Zeit</SelectItem>
                      <SelectItem value="priority">Nach Priorität</SelectItem>
                      <SelectItem value="type">Nach Bestelltyp</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-char">Fertige Bestellungen ausblenden nach</Label>
                  <Select 
                    value={String(localSettings.display.autoHideDoneAfter)}
                    onValueChange={value => setLocalSettings(prev => ({
                      ...prev,
                      display: { ...prev.display, autoHideDoneAfter: parseInt(value) }
                    }))}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Nie ausblenden</SelectItem>
                      <SelectItem value="1">1 Minute</SelectItem>
                      <SelectItem value="5">5 Minuten</SelectItem>
                      <SelectItem value="10">10 Minuten</SelectItem>
                      <SelectItem value="30">30 Minuten</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between p-4 bg-stone-50 rounded-xl">
                  <div>
                    <p className="font-medium text-char">Erledigte Bestellungen anzeigen</p>
                    <p className="text-sm text-steel">Zeigt abgeschlossene Bestellungen im Filter</p>
                  </div>
                  <Switch 
                    checked={localSettings.display.showCompletedOrders}
                    onCheckedChange={checked => setLocalSettings(prev => ({
                      ...prev,
                      display: { ...prev.display, showCompletedOrders: checked }
                    }))}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Notifications Tab */}
            <TabsContent value="notifications" className="mt-0 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-char mb-1">Benachrichtigungen</h3>
                <p className="text-sm text-steel">Wann und wie Sie benachrichtigt werden</p>
              </div>

              <div className="flex items-center justify-between p-4 bg-stone-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-saffron" />
                  <div>
                    <p className="font-medium text-char">Browser-Benachrichtigungen</p>
                    <p className="text-sm text-steel">Push-Benachrichtigungen im Browser</p>
                  </div>
                </div>
                <Switch 
                  checked={localSettings.notifications.browserNotifications}
                  onCheckedChange={checked => setLocalSettings(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, browserNotifications: checked }
                  }))}
                />
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-char">Dringende Bestellung nach (Minuten)</Label>
                  <p className="text-xs text-steel">Bestellungen werden als dringend markiert nach dieser Zeit</p>
                  <Select 
                    value={String(localSettings.notifications.urgentOrderThreshold)}
                    onValueChange={value => setLocalSettings(prev => ({
                      ...prev,
                      notifications: { ...prev.notifications, urgentOrderThreshold: parseInt(value) }
                    }))}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 Minuten</SelectItem>
                      <SelectItem value="10">10 Minuten</SelectItem>
                      <SelectItem value="15">15 Minuten</SelectItem>
                      <SelectItem value="20">20 Minuten</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-char">Kunde anrufen nach (Minuten)</Label>
                  <p className="text-xs text-steel">Zeit bis der Status zu &quot;Kunde anrufen&quot; wechselt</p>
                  <Select 
                    value={String(localSettings.notifications.callCustomerAfter)}
                    onValueChange={value => setLocalSettings(prev => ({
                      ...prev,
                      notifications: { ...prev.notifications, callCustomerAfter: parseInt(value) }
                    }))}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Minute</SelectItem>
                      <SelectItem value="2">2 Minuten</SelectItem>
                      <SelectItem value="3">3 Minuten</SelectItem>
                      <SelectItem value="5">5 Minuten</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* Store Tab */}
            <TabsContent value="store" className="mt-0 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-char mb-1">Restaurant-Informationen</h3>
                <p className="text-sm text-steel">Diese Daten erscheinen auf Bons und Belegen</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-char">Restaurantname</Label>
                  <Input
                    value={localSettings.store.storeName}
                    onChange={e => setLocalSettings(prev => ({
                      ...prev,
                      store: { ...prev.store, storeName: e.target.value }
                    }))}
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-char">Adresse</Label>
                  <Input
                    value={localSettings.store.storeAddress}
                    onChange={e => setLocalSettings(prev => ({
                      ...prev,
                      store: { ...prev.store, storeAddress: e.target.value }
                    }))}
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-char">Telefonnummer</Label>
                  <Input
                    value={localSettings.store.phoneNumber}
                    onChange={e => setLocalSettings(prev => ({
                      ...prev,
                      store: { ...prev.store, phoneNumber: e.target.value }
                    }))}
                    className="rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-char">Währung</Label>
                    <Select 
                      value={localSettings.store.currency}
                      onValueChange={value => setLocalSettings(prev => ({
                        ...prev,
                        store: { ...prev.store, currency: value }
                      }))}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EUR">EUR (Euro)</SelectItem>
                        <SelectItem value="CHF">CHF (Franken)</SelectItem>
                        <SelectItem value="USD">USD (Dollar)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-char">MwSt. (%)</Label>
                    <Input
                      type="number"
                      value={localSettings.store.taxRate}
                      onChange={e => setLocalSettings(prev => ({
                        ...prev,
                        store: { ...prev.store, taxRate: parseFloat(e.target.value) }
                      }))}
                      className="rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-char">Bon-Fusszeile</Label>
                  <Input
                    value={localSettings.store.receiptFooter}
                    onChange={e => setLocalSettings(prev => ({
                      ...prev,
                      store: { ...prev.store, receiptFooter: e.target.value }
                    }))}
                    placeholder="z.B. Vielen Dank für Ihren Besuch!"
                    className="rounded-xl"
                  />
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-stone-50 border-t border-stone-200">
          <Button
            variant="outline"
            onClick={() => setLocalSettings(defaultSettings)}
            className="rounded-xl text-steel"
          >
            Auf Standard zurücksetzen
          </Button>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
              <X className="w-4 h-4 mr-1.5" />
              Abbrechen
            </Button>
            <Button onClick={handleSave} className="bg-saffron hover:bg-saffron-deep text-white rounded-xl">
              <Check className="w-4 h-4 mr-1.5" />
              Speichern
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
