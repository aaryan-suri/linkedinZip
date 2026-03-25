# How This LinkedIn Zip Solver Actually Works

Hey! So I was playing the Zip puzzle on LinkedIn every day and got tired of doing it manually. I noticed that when the page loads, there's a hidden `<script>` tag with id `rehydrate-data` that contains a bunch of JSON. Inside that JSON, there's a field called `"solution"` which is literally the list of cells you need to click in the correct order.

### The Trick

LinkedIn already knows the answer before you even start playing — they just hide it in that script tag for their own frontend to use. We're basically "stealing" their solution instead of solving the puzzle ourselves.

### Step-by-step Breakdown

1. **Wait for the page**  
   The script starts running as soon as the page begins loading (`@run-at document-start`).

2. **Poll for the data**  
   Every 200ms it checks if `#rehydrate-data` exists and has content. It gives up after about 12 seconds.

3. **Extract the solution**  
   Uses regex to find the part that looks like `"solution":[1,5,3,12,...]`  
   Then turns that string into a real JavaScript array with `JSON.parse()`.

4. **Simulate clicks**  
   For each number in the solution array, it finds the cell using `[data-cell-idx="X"]`  
   Then fires a bunch of real browser events (pointerdown → mousedown → click → mouseup → pointerup) so it feels like a human click.

5. **Add delay**  
   Clicks are spaced ~85ms apart so it doesn't look super robotic.

### Why this approach?

- No need to actually understand the puzzle logic (way easier)
- Super fast once the data loads
- Only runs on the Zip page, so it's safe

If LinkedIn ever removes the `rehydrate-data` or changes how they store the solution, this will stop working and I'll have to update it.

Let me know if you want me to add random delays, a manual "Solve" button, or anything else!

– Aaryan
