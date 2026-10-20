@php($rp = fn ($n) => \App\Services\Receipt::rupiah($n))
<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>Struk {{ $b->order_id }}</title>
<style>
  @page { margin: 28px 30px; }
  * { font-family: DejaVu Sans, sans-serif; }
  body { color: #1A1A2E; font-size: 10.5px; line-height: 1.45; }
  .head { border-bottom: 2px solid #1A1A2E; padding-bottom: 10px; margin-bottom: 14px; }
  .brand { font-size: 20px; font-weight: bold; color: #7C3AED; }
  .muted { color: #6b7280; }
  .title { font-size: 13px; font-weight: bold; letter-spacing: 2px; }
  table { width: 100%; border-collapse: collapse; }
  .meta td { padding: 2px 0; vertical-align: top; }
  .meta td.l { color: #6b7280; width: 38%; }
  .items { margin-top: 14px; }
  .items th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; border-bottom: 1px solid #d1d5db; padding: 6px 0; }
  .items td { padding: 8px 0; border-bottom: 1px solid #eee; vertical-align: top; }
  .r, .items th.r { text-align: right; }
  .sum td { padding: 3px 0; }
  .total td { font-size: 14px; font-weight: bold; border-top: 2px solid #1A1A2E; padding-top: 8px; }
  .total td.r { color: #7C3AED; }
  .stamp { display: inline-block; border: 2px solid #16a34a; color: #16a34a; font-weight: bold; font-size: 13px; letter-spacing: 3px; padding: 3px 12px; border-radius: 6px; }
  .foot { margin-top: 22px; text-align: center; color: #6b7280; font-size: 9.5px; }
</style>
</head>
<body>
  <table class="head">
    <tr>
      <td>
        <div class="brand">{{ config('app.name') }}</div>
        <div class="muted">Self Photo Studio</div>
      </td>
      <td class="r">
        <div class="title">STRUK PEMBAYARAN</div>
        <div class="muted">{{ $number }}</div>
      </td>
    </tr>
  </table>

  <table class="meta">
    <tr><td class="l">Order ID</td><td>{{ $b->order_id }}</td></tr>
    <tr><td class="l">Tanggal bayar</td><td>{{ $paidAt }} WIB</td></tr>
    <tr><td class="l">Nama</td><td>{{ $b->customer_name }}</td></tr>
    <tr><td class="l">Email</td><td>{{ $b->customer_email }}</td></tr>
    @if ($b->customer_phone)<tr><td class="l">No. HP</td><td>{{ $b->customer_phone }}</td></tr>@endif
  </table>

  <table class="items">
    <thead><tr><th>Deskripsi</th><th class="r">Jumlah</th></tr></thead>
    <tbody>
      <tr>
        <td>
          <strong>Sesi Foto · {{ $b->studio?->name }}</strong><br>
          <span class="muted">{{ $date }}, {{ $b->timeRange() }} WIB<br>{{ $b->sessions }} sesi × 30 menit</span>
        </td>
        <td class="r">{{ $rp($subtotal) }}</td>
      </tr>
    </tbody>
  </table>

  <table class="sum" style="margin-top: 8px;">
    <tr><td class="muted">Subtotal</td><td class="r">{{ $rp($subtotal) }}</td></tr>
    @if ((int) $b->discount_amount > 0)
      <tr><td class="muted">Diskon{{ $b->promoCode ? ' (' . $b->promoCode->code . ')' : '' }}</td><td class="r">− {{ $rp($b->discount_amount) }}</td></tr>
    @endif
  </table>
  <table class="total" style="margin-top: 6px;">
    <tr><td>Total</td><td class="r">{{ $rp($p->amount) }}</td></tr>
  </table>

  <table class="sum" style="margin-top: 10px;">
    <tr><td class="muted">Metode pembayaran</td><td class="r">{{ $method }}</td></tr>
    @if ($p->cash_received !== null)
      <tr><td class="muted">Uang diterima</td><td class="r">{{ $rp($p->cash_received) }}</td></tr>
      <tr><td class="muted">Kembalian</td><td class="r">{{ $rp($p->cash_change) }}</td></tr>
    @endif
    @if ($p->gateway_ref && $p->gateway !== 'cash')
      <tr><td class="muted">Ref. transaksi</td><td class="r">{{ $p->gateway_ref }}</td></tr>
    @endif
  </table>

  <div style="text-align: center; margin-top: 18px;"><span class="stamp">LUNAS</span></div>

  <div class="foot">
    Terima kasih sudah booking di {{ config('app.name') }}!<br>
    Struk ini sah tanpa tanda tangan · dibuat {{ now()->locale('id')->translatedFormat('d F Y, H:i') }} WIB
  </div>
</body>
</html>
