# Throw Data Detection Requirements

**Purpose:** Define what detection fields should be added to throws

---

## Fields to Add

### X01 Notable (score-based)
- `throw.notable = '180'` | `'ton-plus'` | `'ton'` | `'near-ton'` | null
- Values: 180, 140-179, 100-139, 95-99, or less than 95

### X01 Checkout
- `throw.checkout = true` when `remaining === 0`
- `throw.checkout_darts = 1|2|3` (darts used on checkout round)

### Cricket Closeout
- `throw.closed_out = true` for final throw by winner
- `throw.closeout_darts = 1|2|3` (darts used on closeout)

### Cork (First Throw)
- Detect from `throws[0]` home/away player
- No field needed; calculate at render time

---

## Detection Logic

### Notable Detection
```
score === 180      → '180'
score >= 140       → 'ton-plus'
score >= 100       → 'ton'
score >= 95        → 'near-ton'
otherwise          → null
```

### Checkout Detection
```
remaining === 0    → checkout = true
count darts from round start to current throw
→ checkout_darts = 1|2|3
```

### Closeout Detection (Cricket)
```
Is final throw?    → yes: check winner
Winning side?      → yes: closed_out = true
Count hit notation → closeout_darts = 1|2|3
```

---

## Data Structure Example

```javascript
// X01 checkout throw
{
    round: 9,
    home: {
        player: "Matt Pagel",
        score: 43,
        remaining: 0,
        notable: null,        // May have notable
        checkout: true,       // NEW
        checkout_darts: 2     // NEW
    }
}

// Cricket closeout throw (final)
{
    round: 13,
    away: {
        player: "J. Ragnoni",
        hit: "SBx2",
        marks: 2,
        closed_out: true,     // NEW
        closeout_darts: 2     // NEW
    }
}
```

---

## Display Usage

- **Cork:** Yellow "C" badge next to first-throw player
- **Checkout:** "★ OUT: 43" in yellow, "(2)" darts count
- **Closeout:** "★ CLOSED (7M)" in yellow, "(2)" darts count

---

## Stats Aggregation

- Count total 180s, tons, ton-pluses
- Track checkout attempts vs successful (by range)
- Track cricket closeout marks (9M, 8M, 7M, 6M, 5M)
- Calculate percentages and averages

