// EMV QR Code Generator for PromptPay (Thai Banking Standard)
// Reference: https://www.bot.or.th/Thai/PaymentSystems/StandardPS/Documents/ThaiQRCode_Standard.pdf

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

function merchantInfo(promptPayId: string): string {
  // ID 00: GUID for PromptPay
  const guid = emvField('00', 'A000000677010111');
  // ID 01: PromptPay ID
  // Phone: normalize → 66xxxxxxxx
  let id = promptPayId.replace(/[^0-9]/g, '');
  if (id.startsWith('0')) id = '66' + id.slice(1);
  const idField = emvField('01', '0' + id);
  return emvField('29', guid + idField);
}

export function generatePromptPayQR(promptPayId: string, amount?: number): string {
  const payload = [
    emvField('00', '01'),              // Payload Format Indicator
    emvField('01', amount ? '12' : '11'), // Point of Initiation (12=dynamic QR with amount)
    merchantInfo(promptPayId),
    emvField('53', '764'),             // Transaction Currency (764 = THB)
    ...(amount ? [emvField('54', amount.toFixed(2))] : []),
    emvField('58', 'TH'),              // Country Code
    emvField('59', 'MuuNun'),          // Merchant Name
    emvField('60', 'Bangkok'),         // Merchant City
    '6304',                            // CRC placeholder
  ].join('');

  const crc = crc16(payload);
  return payload + crc;
}
