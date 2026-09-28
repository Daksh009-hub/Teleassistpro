// Auto-Revival Calculation Logic for Lapsed LIC Policies

export function calculateRevival({
  premiumAmount = 0,
  lastPaidDate,
  interestRateAnnual = 8.0 // standard 8% p.a. as per PRD
}) {
  const premium = parseFloat(premiumAmount) || 0;
  if (!lastPaidDate || premium <= 0) {
    return {
      lapseMonths: 0,
      lapseDays: 0,
      lateFee: 0,
      netPayable: premium,
      isLapsed: false
    };
  }

  const lastDate = new Date(lastPaidDate);
  const today = new Date();
  
  if (isNaN(lastDate.getTime())) {
    return { lapseMonths: 0, lapseDays: 0, lateFee: 0, netPayable: premium, isLapsed: false };
  }

  const totalDays = Math.max(0, Math.floor((today - lastDate) / (1000 * 60 * 60 * 24)));
  const lapseMonths = +(totalDays / 30.4375).toFixed(1);
  const isLapsed = totalDays > 30; // standard grace period 30 days

  // Formula from PRD: late_fee = (premium_amount * late_fee_rate * lapse_months) / 12
  const lateFee = isLapsed ? Math.round((premium * (interestRateAnnual / 100) * lapseMonths) / 12) : 0;
  const netPayable = premium + lateFee;

  return {
    lapseMonths,
    lapseDays: totalDays,
    lateFee,
    netPayable,
    isLapsed,
    interestRateAnnual
  };
}
