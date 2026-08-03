# Things I Didn't Get To

Security: There is no implemented security solution. 
    - JWT Token implementation with Spring Security

Pagination: A sample day is relatively light on total transactions, and the API response is already getting a bit large in terms of size.

- Implement pagination so transactions can be pulled in much smaller chunks. A large part of the app only cares about the totals, and the totals could be provided by the API response which eliminates the need for the frontend to have all the data present at once just so it can add up the columns.
- The actual transaction information can be called for only when it is necessary for it to come into view or ideally be retrieved "just" before it is necessary. There would need be some care taken to ensure that sales/refunds and things with multiple settlement windows would be packaged in the same response.

Database Optimization: I have not attempted to optimize the database at all. I have added only the necessary fields, a table to hold the matching relationship of ledger to processor settlement, and foreign keys to enforce idempotentcy.
    - Analyze opportunities for Indexes
    - Analyze whether normalizing the database helps or hinders performance assuming that space is not a large concern.
    - Analyze data for proper constraints on columns such as not null, varchar limits, and etc.

Multiple Breaks: I did not make any special effort to handle situations where a transaction could fall into multiple break categories at once. I didn't detect any in the test data.

- However, if multiple breaks on one transaction were to occur then the current code would flag the first category break it processed. If the reason for the first break was cleared the transaction, then in theory the transaction would be reprocessed. The second break would capture the transaction in a second reprocessing round.

Bad data: I'm not currently checking the individual reasons for why a break is bad, and I'm instead just matching on the 'BAD' tag in the transaction identifiers and merchant ref.

- I could not find any instances of the known reasons that the"BAD" tag was applied to transactions for any transactions without the tag. However, if necessary more thorough validation could be implemented. 

UI on Multiple Screen Sizes: I developed this on a 1440p wide screen. The tables will have scrollbars for screens that are smaller which might not be an ideal experience.

- This sounds like an app for internal use by company staff which likely means the company controls the screen size. Once a specified size is determined changes could be made to accommodate a target screen size or a more responsive design.

Fallback ID matching: I currently have some fairly simplistic fallback matching (merchant ref is blank) on just the merchant_id, card_last4, and card_type. This is insufficient on **extremely** high volume merchants as the chance of collisions with just the space afforded by 4 digits and a handful of card types.

- A more robust strategy could take into account the amounts. However, that would require checking the amounts which would mean doing the fee math and tolerances. The date fields might could come into play to narrow down possibilities as well considering most things settle within a certain time frame. However, I felt further refinement was out of scope considering the size of this exercise.