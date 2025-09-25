# CLAUDE.md - {{bounty_title}}

Go service project-specific AI assistant guidelines for spec-driven bounty implementation.

## Bounty Context & Mission

**Bounty**: {{bounty_title}} ({{bounty_id}})
**Reward**: {{bounty_amount}}
**Organization**: {{organization}}
**Repository**: {{repository}}
**Viability Assessment**: {{viability_category}} ({{viability_score}})
**Estimated Timeline**: {{time_estimate}}

**Mission Statement**: {{viability_reasoning}}

## Go Project Analysis

### Technology Stack
- **Language**: {{primary_language}} with {{frameworks}}
- **Build System**: {{build_tools}}
- **Testing**: {{testing_frameworks}}
- **Quality Tools**: {{linting_tools}}
- **Project Structure**: {{file_organization}}

### Package Architecture
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

## Go Service Implementation Standards

### Code Quality Requirements
- **Idiomatic Go**: Follow effective Go practices and conventions
- **Error Handling**: Explicit error handling with proper context
- **Goroutines**: Safe concurrent programming patterns
- **Interface Design**: Small, focused interfaces
- **Package Organization**: Clear package boundaries and dependencies

### Go Best Practices
- **Naming**: Use clear, descriptive names following Go conventions
- **Error Values**: Custom error types with meaningful messages
- **Context Usage**: Proper context.Context for cancellation and timeouts
- **Resource Management**: Proper cleanup with defer statements
- **Testing**: Table-driven tests and proper test organization

### Service Patterns (Gin/Echo/Gorilla Mux)
- **Handler Functions**: Clean separation of HTTP concerns
- **Middleware**: Logging, authentication, and CORS handling
- **JSON Handling**: Proper struct tags and validation
- **Route Organization**: Logical grouping of endpoints
- **Configuration**: Environment-based configuration management

### Testing Strategy: {{test_strategy}}
- **Unit Tests**: Individual function and method testing
- **HTTP Tests**: httptest for HTTP handler testing
- **Integration Tests**: Database and external service integration
- **Benchmark Tests**: Performance testing with go test -bench
- **Test Fixtures**: Proper test data management

### Build & Development Workflow
- **Go Modules**: Proper go.mod and go.sum management
- **Code Quality**: go fmt, go vet, golint, staticcheck
- **Testing**: go test with coverage reporting
- **Building**: go build with proper flags and optimization
- **Documentation**: godoc for package documentation

## Go Service Implementation Guidance

### Service Development Pattern
1. **Interface Definition**: Define service interfaces first
2. **Model Structures**: Create data models with proper tags
3. **Handler Tests**: Write HTTP handler tests (TDD)
4. **Business Logic**: Implement core business functions
5. **Handler Implementation**: Connect HTTP layer to business logic
6. **Database Integration**: Add persistence layer if needed
7. **Integration Testing**: Test full request-response cycle

### Common Go Service Patterns to Follow
```go
// Request/Response models
type CreateRequest struct {
    Name string `json:"name" validate:"required"`
    Data string `json:"data" validate:"required"`
}

type ApiResponse struct {
    Success bool        `json:"success"`
    Data    interface{} `json:"data,omitempty"`
    Error   string      `json:"error,omitempty"`
}

// HTTP handler with proper error handling
func (s *Service) CreateHandler(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    var req CreateRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        s.writeError(w, http.StatusBadRequest, "Invalid request format")
        return
    }

    if err := s.validator.Struct(&req); err != nil {
        s.writeError(w, http.StatusBadRequest, err.Error())
        return
    }

    result, err := s.businessLogic.Create(ctx, req)
    if err != nil {
        s.handleBusinessError(w, err)
        return
    }

    s.writeJSON(w, http.StatusCreated, ApiResponse{
        Success: true,
        Data:    result,
    })
}
```

### Error Handling Strategy
```go
// Custom error types with context
type ServiceError struct {
    Code    string
    Message string
    Cause   error
}

func (e *ServiceError) Error() string {
    if e.Cause != nil {
        return fmt.Sprintf("%s: %s (%v)", e.Code, e.Message, e.Cause)
    }
    return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// Error handling middleware
func (s *Service) handleBusinessError(w http.ResponseWriter, err error) {
    var serviceErr *ServiceError
    if errors.As(err, &serviceErr) {
        switch serviceErr.Code {
        case "VALIDATION_ERROR":
            s.writeError(w, http.StatusBadRequest, serviceErr.Message)
        case "NOT_FOUND":
            s.writeError(w, http.StatusNotFound, serviceErr.Message)
        default:
            s.writeError(w, http.StatusInternalServerError, "Internal server error")
        }
        return
    }

    log.Printf("Unhandled error: %v", err)
    s.writeError(w, http.StatusInternalServerError, "Internal server error")
}
```

### Concurrency Guidelines
- **Goroutine Management**: Use context for cancellation
- **Channel Communication**: Prefer channels over shared memory
- **Mutex Usage**: Minimize lock contention and avoid deadlocks
- **Worker Pools**: Use worker patterns for concurrent processing
- **Resource Limits**: Implement proper connection pooling

### Database Integration Patterns
```go
// Repository interface
type Repository interface {
    Create(ctx context.Context, item *Item) (*Item, error)
    GetByID(ctx context.Context, id string) (*Item, error)
    Update(ctx context.Context, id string, updates map[string]interface{}) error
    Delete(ctx context.Context, id string) error
}

// Transaction handling
func (r *repo) CreateWithTransaction(ctx context.Context, item *Item) error {
    tx, err := r.db.BeginTx(ctx, nil)
    if err != nil {
        return err
    }
    defer func() {
        if err != nil {
            tx.Rollback()
        } else {
            tx.Commit()
        }
    }()

    // Perform operations within transaction
    return nil
}
```

## Risk Management & Success Criteria

### Risk Assessment
{{risk_assessment}}

### Success Indicators
{{success_indicators}}

### Potential Blockers
{{potential_blockers}}

### Go-Specific Risks
- **Race Conditions**: Careful goroutine synchronization
- **Memory Leaks**: Proper goroutine lifecycle management
- **Interface Changes**: Backward compatibility considerations
- **Dependency Management**: Module version conflicts

## Context Management

### Critical Information (Always Prioritize)
1. Go compiler errors and type mismatches
2. HTTP route definitions and handler signatures
3. Database connection and query patterns
4. Goroutine synchronization and context usage
5. Error handling and response formatting

### Secondary Information
1. go.mod dependencies and version constraints
2. Performance profiling and optimization opportunities
3. Docker deployment and build configuration
4. API documentation and swagger definitions

## Session Focus

### Primary Goal
Complete {{bounty_title}} following Go service best practices

### Quality Gates
- [ ] Code passes go vet and golint checks
- [ ] All tests pass with good coverage (>80%)
- [ ] HTTP endpoints return proper status codes
- [ ] Error handling provides meaningful messages
- [ ] Goroutines are properly managed
- [ ] Database operations use proper transactions
- [ ] Documentation is complete and accurate

### Go-Specific Validation
- [ ] No race conditions detected
- [ ] Memory usage is optimal
- [ ] Context usage follows best practices
- [ ] Interface definitions are clean and focused
- [ ] Error types provide sufficient context

---

**Generated**: {{generated_date}}
**Methodology**: Spec-driven development for Go services
**Pipeline**: claude-code-bounty-pipe