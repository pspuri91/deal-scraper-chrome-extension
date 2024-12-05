export function parseCronExpression(expression) {
  const parts = expression.split(' ');
  if (parts.length !== 5) {
    throw new Error('Invalid cron expression');
  }

  return {
    minutes: parseField(parts[0], 0, 59),
    hours: parseField(parts[1], 0, 23),
    daysOfMonth: parseField(parts[2], 1, 31),
    months: parseField(parts[3], 1, 12),
    daysOfWeek: parseField(parts[4], 0, 6)
  };
}

export function matchCron(cronExp, date) {
  return (
    matchField(cronExp.minutes, date.getMinutes()) &&
    matchField(cronExp.hours, date.getHours()) &&
    matchField(cronExp.daysOfMonth, date.getDate()) &&
    matchField(cronExp.months, date.getMonth() + 1) &&
    matchField(cronExp.daysOfWeek, date.getDay())
  );
}

function parseField(field, min, max) {
  if (field === '*') return { type: 'any' };
  
  if (field.includes('/')) {
    const [, step] = field.split('/');
    return { type: 'step', value: parseInt(step, 10) };
  }
  
  if (field.includes('-')) {
    const [start, end] = field.split('-').map(n => parseInt(n, 10));
    return { type: 'range', start, end };
  }
  
  return { type: 'value', value: parseInt(field, 10) };
}

function matchField(fieldExp, value) {
  switch (fieldExp.type) {
    case 'any':
      return true;
    case 'value':
      return value === fieldExp.value;
    case 'range':
      return value >= fieldExp.start && value <= fieldExp.end;
    case 'step':
      if (fieldExp.value === 1) return true;
      return value % fieldExp.value === 0;
    default:
      return false;
  }
}