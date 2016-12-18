module.exports = {
  setToString: entity => `${entity.subject}_${entity.time}_${entity.paper}_${entity.variant}`,
  setEqual: (a, b) => a.subject === b.subject && a.time === b.time && a.paper === b.paper && a.variant === b.variant
}
