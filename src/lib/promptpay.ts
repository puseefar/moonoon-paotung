// EMV QR Code Generator for PromptPay (Thai Banking Standard)
// Reference: https://www.bot.or.th/Thai/PaymentSystems/StandardPS/Documents/ThaiQRCode_Standard.pdf
// Logic based on the promptpay-qr library by dtinth (https://github.com/dtinth/promptpay-qr)

function crc16(data: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
      else crc = crc << 1;
    }
  }
  return ((crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0'));
}

function emvField(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

// PromptPay field IDs per BOT spec
// '01' = phone number, '02' = national/tax ID, '03' = e-Wallet
function formatTarget(id: string): { fieldId: string; value: string } {
  const digits = id.replace(/[^0-9]/g, '');
  if (digits.length >= 15) {
    return { fieldId: '03', value: digits };
  }
  if (digits.length >= 13) {
    return { fieldId: '02', value: digits };
  }
  // Phone: normalize to 13-char international format (0066XXXXXXXXX)
  const international = ('0000000000000' + digits.replace(/^0/, '66')).slice(-13);
  return { fieldId: '01', value: international };
}

function merchantInfo(promptPayId: string): string {
  const guid = emvField('00', 'A000000677010111');
  const { fieldId, value } = formatTarget(promptPayId);
  const idField = emvField(fieldId, value);
  return emvField('29', guid + idField);
}

export function generatePromptPayQR(promptPayId: string, amount?: number): string {
  const payload = [
    emvField('00', '01'),
    emvField('01', amount ? '12' : '11'),
    merchantInfo(promptPayId),
    emvField('53', '764'),
    ...(amount ? [emvField('54', amount.toFixed(2))] : []),
    emvField('58', 'TH'),
    emvField('59', 'MuuNun'),
    emvField('60', 'Bangkok'),
    '6304',
  ].join('');

  const crc = crc16(payload);
  return payload + crc;
}
