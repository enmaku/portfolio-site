export function getRoleBadge(seat) {
  if (seat?.role?.type === 'human') return { label: 'Human ●', color: 'primary' }
  if (seat?.role?.type === 'nn') return { label: 'NN ◆', color: 'deep-purple' }
  return { label: 'Bot ■', color: 'teal' }
}
