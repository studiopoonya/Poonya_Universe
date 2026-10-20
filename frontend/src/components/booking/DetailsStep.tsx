import { useState } from 'react'
import PrimaryButton from '@/components/ui/PrimaryButton'
import StepActions from '@/components/ui/StepActions'

interface CustomerDetails {
  customer_name: string
  customer_email: string
  customer_phone: string
  notes: string
}

interface Props {
  onNext: (data: CustomerDetails) => void
  onBack: () => void
  initialValues?: Partial<CustomerDetails>
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1.5">{label}</label>
      <input
        {...props}
        className="w-full px-4 py-3 rounded-xl bg-surface-subtle border border-transparent text-base md:text-sm font-medium text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-brand-500 focus:bg-white transition-all"
      />
    </div>
  )
}

export default function DetailsStep({ onNext, onBack, initialValues }: Props) {
  const [form, setForm] = useState<CustomerDetails>({
    customer_name:  initialValues?.customer_name  ?? '',
    customer_email: initialValues?.customer_email ?? '',
    customer_phone: initialValues?.customer_phone ?? '',
    notes:          initialValues?.notes          ?? '',
  })
  const [errors, setErrors] = useState<Partial<CustomerDetails>>({})

  const update = (k: keyof CustomerDetails) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setErrors((err) => ({ ...err, [k]: '' }))
  }

  const validate = (): boolean => {
    const e: Partial<CustomerDetails> = {}
    // Same rules as the backend (StoreBookingRequest), so mistakes show here, not at payment
    const email = form.customer_email.trim()
    const phone = form.customer_phone.replace(/[\s\-.()]/g, '')
    if (! form.customer_name.trim()) e.customer_name  = 'Nama wajib diisi'
    if (! email)                     e.customer_email = 'Email wajib diisi'
    else if (! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.customer_email = 'Format email tidak valid, contoh: nama@gmail.com'
    if (! phone)                     e.customer_phone = 'Nomor HP wajib diisi'
    else if (! /^\+?[0-9]{8,15}$/.test(phone))           e.customer_phone = 'Nomor HP tidak valid. Gunakan 8–15 angka, contoh 081234567890'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = () => {
    if (validate()) onNext(form)
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">Detail Kamu</h2>
      <p className="text-sm text-gray-400 mb-6">Isi data diri untuk konfirmasi booking.</p>

      <div className="space-y-4">
        <div>
          <Field
            label="Nama Lengkap"
            placeholder="Nama kamu"
            autoComplete="name"
            enterKeyHint="next"
            value={form.customer_name}
            onChange={update('customer_name')}
          />
          {errors.customer_name && <p className="text-red-500 text-xs mt-1">{errors.customer_name}</p>}
        </div>

        <div>
          <Field
            label="Email"
            type="email"
            placeholder="email@kamu.com"
            autoComplete="email"
            inputMode="email"
            enterKeyHint="next"
            value={form.customer_email}
            onChange={update('customer_email')}
          />
          {errors.customer_email && <p className="text-red-500 text-xs mt-1">{errors.customer_email}</p>}
        </div>

        <div>
          <Field
            label="Nomor HP / WhatsApp"
            type="tel"
            placeholder="08xxxxxxxxxx"
            autoComplete="tel"
            inputMode="tel"
            enterKeyHint="next"
            value={form.customer_phone}
            onChange={update('customer_phone')}
          />
          {errors.customer_phone && <p className="text-red-500 text-xs mt-1">{errors.customer_phone}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Catatan (opsional)</label>
          <textarea
            rows={3}
            placeholder="Preferensi outfit, tema, dsb."
            value={form.notes}
            onChange={update('notes') as any}
            className="w-full px-4 py-3 rounded-xl bg-surface-subtle border border-transparent text-base md:text-sm font-medium text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-brand-500 focus:bg-white transition-all resize-none"
          />
        </div>
      </div>

      <StepActions>
        <PrimaryButton variant="ghost" aria-label="Kembali" onClick={onBack} className="w-auto shrink-0 px-4">
          ← <span className="hidden xs:inline">Kembali</span>
        </PrimaryButton>
        <PrimaryButton onClick={handleSubmit}>
          Lanjut →
        </PrimaryButton>
      </StepActions>
    </div>
  )
}
