'use client'

import { Keyboard } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { shortcutsList } from '@/hooks/use-keyboard-shortcuts'
import { Button } from '@/components/ui/button'

export function KeyboardHelp() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 text-stone-500">
          <Keyboard className="w-4 h-4" />
          <span className="hidden lg:inline">Tastenkürzel</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-white rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-saffron" />
            Tastenkürzel
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 mt-4">
          {shortcutsList.map((shortcut) => (
            <div 
              key={shortcut.key} 
              className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-stone-50"
            >
              <span className="text-sm text-stone-600">{shortcut.description}</span>
              <kbd className="inline-flex items-center justify-center min-w-[40px] px-2 py-1 text-xs font-semibold bg-stone-100 text-stone-700 rounded-md border border-stone-200">
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
