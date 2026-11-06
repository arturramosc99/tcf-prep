import { STATUS_HELP, STATUS_LABEL, type Status } from '@/lib/status';

// ON/OFF-style pill in traffic-light colours: red = critical, yellow = active/watching, green = under control/resolved.
export function StatusToggle({ status }: { status: Status }) {
  const cls = { critique: 'bad', actif: 'warn', observation: 'warn ghost', controle: 'good ghost', resolu: 'good' }[status];
  return (
    <span className={`toggle ${cls}`} title={STATUS_HELP[status]}>
      <span>{STATUS_LABEL[status]}</span>
      <i />
    </span>
  );
}
