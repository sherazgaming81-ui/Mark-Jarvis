# The two edits to `src/app/page.tsx`

If you are building by hand instead of applying `chatbot.patch`, `page.tsx` needs
exactly two changes. Everything else is a new file.

---

## Edit 1 — add the import

Find the existing component imports at the top of the file (they include
`BookingDialog`, `icons`, `Modal`, …) and add one line:

```tsx
import { BookingDialog } from "@/components/booking-dialog";
import { ChatWidget } from "@/components/chat-widget";     // ← add this line
import { Brand, BrandMark, Contours, Icon, type IconName } from "@/components/icons";
```

---

## Edit 2 — render the widget

The file returns a fragment. Right after the `{bookingOpen && <BookingDialog … />}`
line (and before the closing `</>`), add:

```tsx
    {bookingOpen && <BookingDialog initialService={bookingService} onClose={() => setBookingOpen(false)} />}
    <ChatWidget onBook={(serviceId) => openBooking(serviceId ?? "")} />     {/* ← add this line */}
  </>;
```

`openBooking` already exists in the component and already accepts a service id,
so nothing else in the file changes. The widget hands a visitor into the same
estimate-request dialog the rest of the site uses, pre-selecting a service when
the assistant identified one.

---

## Also in `page.tsx`? No.

The assistant does not need any other page change: no nav entry, no extra state,
no new prop. If you find yourself editing more of this file, stop and apply
`chatbot.patch` instead.
