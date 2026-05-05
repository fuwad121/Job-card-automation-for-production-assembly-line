export const stageTemplates = [
  {
    name: "Stage 1",
    tasks: [
      { description: "Verify job card details", required: 1 },
      { description: "Check incoming parts and tools", required: 1 },
      { description: "Record any initial issues", required: 0 }
    ]
  },
  {
    name: "Stage 2",
    tasks: [
      { description: "Assemble frame components", required: 1 },
      { description: "Secure fasteners to spec", required: 1 },
      { description: "Note fitment observations", required: 0 }
    ]
  },
  {
    name: "Stage 3",
    tasks: [
      { description: "Install wiring and power path", required: 1 },
      { description: "Confirm connector integrity", required: 1 },
      { description: "Capture wiring photo if needed", required: 0 }
    ]
  },
  {
    name: "Stage 4",
    tasks: [
      { description: "Mount avionics modules", required: 1 },
      { description: "Check label and serial mapping", required: 1 },
      { description: "Add integration remarks", required: 0 }
    ]
  },
  {
    name: "Stage 5",
    tasks: [
      { description: "Run basic functional checks", required: 1 },
      { description: "Confirm safety points closed", required: 1 },
      { description: "Attach evidence image if relevant", required: 0 }
    ]
  },
  {
    name: "Stage 6",
    tasks: [
      { description: "Perform final visual inspection", required: 1 },
      { description: "Verify job ready for handoff", required: 1 },
      { description: "Record closing remarks", required: 0 }
    ]
  }
];

