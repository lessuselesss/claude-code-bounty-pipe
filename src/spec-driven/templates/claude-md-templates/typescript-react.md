# CLAUDE.md - {{bounty_title}}

TypeScript/React project-specific AI assistant guidelines for spec-driven bounty implementation.

## Bounty Context & Mission

**Bounty**: {{bounty_title}} ({{bounty_id}})
**Reward**: {{bounty_amount}}
**Organization**: {{organization}}
**Repository**: {{repository}}
**Viability Assessment**: {{viability_category}} ({{viability_score}})
**Estimated Timeline**: {{time_estimate}}

**Mission Statement**: {{viability_reasoning}}

## TypeScript/React Project Analysis

### Technology Stack
- **Language**: {{primary_language}} with {{frameworks}}
- **Build Tools**: {{build_tools}}
- **Testing**: {{testing_frameworks}}
- **Quality Tools**: {{linting_tools}}
- **Project Structure**: {{file_organization}}

### Component Architecture
- **Entry Points**:
{{entry_points}}

- **Test Directories**:
{{test_directories}}

## Spec-Driven Requirements (EARS Format)

### Primary Requirements
{{primary_requirements}}

### Acceptance Criteria (Must-Have)
{{acceptance_criteria}}

### System Constraints
{{constraints}}

### Working Assumptions
{{assumptions}}

## System Design & Architecture

**Technical Approach**: {{technical_approach}}

### Architecture Changes Required
{{architecture_changes}}

### Integration Points
{{integration_points}}

### Data Flow
{{data_flow}}

## Implementation Plan: Discrete Tasks

{{discrete_tasks}}

**Summary**: {{task_count}} total tasks ({{high_priority_tasks}} high priority)

## TypeScript/React Implementation Standards

### Code Quality Requirements
- **Type Safety**: Use strict TypeScript configuration
- **Component Patterns**: Follow existing component structure (functional vs class)
- **State Management**: Use established patterns (useState, useContext, Redux, Zustand)
- **Styling**: Follow existing CSS/styled-components/Tailwind patterns
- **Import Organization**: Group imports (React, libraries, local modules)

### React Best Practices
- **Functional Components**: Prefer hooks over class components
- **Performance**: Use React.memo, useMemo, useCallback appropriately
- **Accessibility**: Ensure ARIA compliance and semantic HTML
- **Error Boundaries**: Implement proper error handling
- **Testing**: Test components, hooks, and integration flows

### TypeScript Conventions
- **Interface Definitions**: Define clear props and state interfaces
- **Generic Types**: Use generics for reusable components
- **Utility Types**: Leverage Pick, Omit, Partial appropriately
- **Strict Mode**: Enable strict type checking
- **Path Mapping**: Use established import aliases

### Testing Strategy: {{test_strategy}}
- **Unit Tests**: Component logic and utility functions
- **Integration Tests**: Component interactions and data flow
- **E2E Tests**: User workflows and critical paths
- **Testing Libraries**: React Testing Library best practices
- **Mock Strategy**: Mock external dependencies appropriately

### Build & Development Workflow
- **Hot Reload**: Leverage development server capabilities
- **Type Checking**: Run TypeScript compiler alongside bundler
- **Linting**: ESLint + Prettier configuration
- **Bundle Analysis**: Monitor bundle size and performance
- **Environment Variables**: Use .env files properly

## React-Specific Implementation Guidance

### Component Development Pattern
1. **Interface Definition**: Define component props interface
2. **Test Cases**: Write component tests first (TDD)
3. **Component Implementation**: Build minimum viable component
4. **State Management**: Add state logic with proper types
5. **Effects & Lifecycle**: Implement useEffect patterns
6. **Performance Optimization**: Add memoization if needed
7. **Integration Testing**: Test component in context

### Common React Patterns to Follow
```typescript
// Props interface definition
interface ComponentProps {
  data: DataType;
  onAction: (value: string) => void;
  className?: string;
}

// Functional component with TypeScript
const Component: React.FC<ComponentProps> = ({ data, onAction, className }) => {
  const [state, setState] = useState<StateType>(initialState);

  const handleAction = useCallback((value: string) => {
    onAction(value);
  }, [onAction]);

  return (
    <div className={className}>
      {/* Component JSX */}
    </div>
  );
};
```

### State Management Guidelines
- **Local State**: useState for component-specific state
- **Context**: useContext for shared state across components
- **External State**: Redux/Zustand for complex application state
- **Server State**: React Query/SWR for API data
- **Form State**: Formik/React Hook Form for form handling

### Performance Considerations
- **Re-render Optimization**: Use React.memo for expensive components
- **Callback Stability**: useCallback for event handlers
- **Expensive Calculations**: useMemo for computed values
- **Code Splitting**: React.lazy for route-based splitting
- **Bundle Size**: Monitor and optimize dependency imports

## Risk Management & Success Criteria

### Risk Assessment
{{risk_assessment}}

### Success Indicators
{{success_indicators}}

### Potential Blockers
{{potential_blockers}}

### React-Specific Risks
- **Type Definition Conflicts**: Ensure compatibility with existing types
- **State Management Complexity**: Avoid over-engineering simple state
- **Performance Regressions**: Monitor re-render frequency
- **Dependency Updates**: Verify compatibility with existing packages

## Context Management

### Critical Information (Always Prioritize)
1. TypeScript errors and type mismatches
2. React component hierarchy and data flow
3. State management patterns in existing codebase
4. CSS/styling methodology being used
5. Testing patterns and mock strategies

### Secondary Information
1. Build configuration and bundler setup
2. Performance optimization opportunities
3. Accessibility compliance requirements
4. Browser compatibility needs

## Session Focus

### Primary Goal
Complete {{bounty_title}} following React/TypeScript best practices

### Quality Gates
- [ ] All TypeScript types properly defined
- [ ] Components follow existing patterns
- [ ] Tests pass with good coverage
- [ ] No React performance warnings
- [ ] Accessibility standards met
- [ ] Bundle size impact minimized

---

**Generated**: {{generated_date}}
**Methodology**: Spec-driven development for TypeScript/React projects
**Pipeline**: claude-code-bounty-pipe