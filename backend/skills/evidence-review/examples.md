# Synthetic review cases

Finding: "Participants want longer meetings."
Answer: "Meetings are already too long."
Expected: remove this assignment; the answer contradicts the finding.

Finding: "Two people raised accessibility concerns."
Sources: two clear answers describing access barriers.
Expected: preserve the concern without calling it uncertain solely because it
is uncommon. Let the application calculate the actual supporting count.

Source: "I like the agenda, but the discussion feels rushed."
Candidate quote: "I like the discussion."
Expected: reject the quote; it is not an exact excerpt and changes the meaning.

Source: "Contact me at person@example.invalid; the entrance needs a ramp."
Expected safe excerpt: "the entrance needs a ramp."
Do not include the address, source label identifying a person, or invented text.
