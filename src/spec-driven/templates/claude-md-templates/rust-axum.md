# CLAUDE.md - {{bounty_title}}

Rust/Axum project-specific AI assistant guidelines for spec-driven bounty implementation.

## Bounty Context & Mission

**Bounty**: {{bounty_title}} ({{bounty_id}})
**Reward**: {{bounty_amount}}
**Organization**: {{organization}}
**Repository**: {{repository}}
**Viability Assessment**: {{viability_category}} ({{viability_score}})
**Estimated Timeline**: {{time_estimate}}

**Mission Statement**: {{viability_reasoning}}

## Rust Project Analysis

### Technology Stack
- **Language**: {{primary_language}} with {{frameworks}}
- **Build System**: {{build_tools}}
- **Testing**: {{testing_frameworks}}
- **Quality Tools**: {{linting_tools}}
- **Project Structure**: {{file_organization}}

### Crate Architecture
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

## Rust/Axum Implementation Standards

### Code Quality Requirements
- **Memory Safety**: Leverage Rust's ownership system effectively
- **Error Handling**: Use Result<T, E> and proper error propagation
- **Async Patterns**: Follow tokio/async-std conventions
- **Type Safety**: Use strong typing and avoid unsafe code
- **Performance**: Optimize for zero-cost abstractions

### Rust Best Practices
- **Ownership**: Clear ownership transfer and borrowing patterns
- **Error Handling**: Custom error types with thiserror/anyhow
- **Async Code**: Proper async/await usage with Send + Sync
- **Modules**: Clear module organization and visibility
- **Documentation**: Comprehensive rustdoc comments

### Axum Web Service Patterns
- **Route Handlers**: Use extractors and response types properly
- **Middleware**: Implement middleware for cross-cutting concerns
- **State Management**: Use Arc<State> for shared application state
- **JSON Handling**: Serde serialization/deserialization
- **Error Responses**: Consistent HTTP error handling

### Testing Strategy: {{test_strategy}}
- **Unit Tests**: Individual function and module testing
- **Integration Tests**: HTTP endpoint testing with test clients
- **Property Tests**: Use proptest for complex data validation
- **Benchmarks**: Criterion for performance regression testing
- **Mock Testing**: Use mockall for external dependencies

### Build & Development Workflow
- **Cargo Commands**: cargo build, cargo test, cargo clippy
- **Feature Flags**: Use cargo features for conditional compilation
- **Documentation**: cargo doc for API documentation
- **Formatting**: cargo fmt with consistent style
- **Linting**: cargo clippy for additional code quality

## Rust/Axum Implementation Guidance

### Service Development Pattern
1. **Type Definitions**: Define request/response structs
2. **Error Types**: Create domain-specific error types
3. **Handler Tests**: Write handler tests first (TDD)
4. **Handler Implementation**: Implement route handlers
5. **Middleware Integration**: Add authentication/logging middleware
6. **Database Integration**: Add persistence layer if needed
7. **Integration Testing**: Test full HTTP request flow

### Common Axum Patterns to Follow
```rust
// Request/Response types
#[derive(Debug, Deserialize)]
struct CreateRequest {
    name: String,
    data: Value,
}

#[derive(Debug, Serialize)]
struct ApiResponse<T> {
    success: bool,
    data: Option<T>,
    error: Option<String>,
}

// Route handler with proper error handling
async fn create_handler(
    State(app_state): State<AppState>,
    Json(request): Json<CreateRequest>,
) -> Result<Json<ApiResponse<CreatedItem>>, ApiError> {
    let item = service::create_item(&app_state.db, request).await?;
    Ok(Json(ApiResponse {
        success: true,
        data: Some(item),
        error: None,
    }))
}
```

### Error Handling Strategy
```rust
// Custom error type with proper HTTP mapping
#[derive(Debug, thiserror::Error)]
enum ApiError {
    #[error("Database error: {0}")]
    Database(#[from] DatabaseError),
    #[error("Validation error: {message}")]
    Validation { message: String },
    #[error("Not found")]
    NotFound,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            ApiError::Database(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Internal error"),
            ApiError::Validation { message } => (StatusCode::BAD_REQUEST, &message),
            ApiError::NotFound => (StatusCode::NOT_FOUND, "Not found"),
        };

        (status, Json(ErrorResponse { error: message.to_string() })).into_response()
    }
}
```

### State Management Guidelines
- **Application State**: Use Arc<AppState> for shared resources
- **Database Connections**: Connection pools (sqlx, deadpool)
- **Configuration**: Environment-based config with serde
- **Caching**: Redis or in-memory caching for performance
- **Background Tasks**: Tokio tasks for async work

### Performance Considerations
- **Zero-Copy**: Use &str and Cow for string handling
- **Memory Allocation**: Minimize allocations in hot paths
- **Async Performance**: Avoid blocking operations in async contexts
- **Database Queries**: Use prepared statements and batching
- **HTTP Performance**: Implement compression and keep-alive

## Risk Management & Success Criteria

### Risk Assessment
{{risk_assessment}}

### Success Indicators
{{success_indicators}}

### Potential Blockers
{{potential_blockers}}

### Rust-Specific Risks
- **Borrow Checker Issues**: Plan data structures to avoid conflicts
- **Async Complexity**: Manage async lifetimes and Send bounds
- **Compilation Time**: Minimize dependencies and generic usage
- **Error Propagation**: Ensure proper error context throughout stack

## Context Management

### Critical Information (Always Prioritize)
1. Rust compiler errors and borrow checker messages
2. Axum route definitions and handler signatures
3. Database schema and query patterns
4. Error handling and response formatting
5. Async context and tokio runtime usage

### Secondary Information
1. Cargo.toml dependencies and features
2. Performance profiling and optimization
3. Docker deployment configuration
4. API documentation and examples

## Session Focus

### Primary Goal
Complete {{bounty_title}} following Rust/Axum best practices

### Quality Gates
- [ ] All code compiles without warnings
- [ ] Comprehensive error handling implemented
- [ ] HTTP endpoints return proper status codes
- [ ] Tests cover success and error cases
- [ ] Database operations are properly async
- [ ] Performance meets baseline requirements
- [ ] Documentation is complete and accurate

### Rust-Specific Validation
- [ ] No unsafe code unless absolutely necessary
- [ ] All potential panics handled gracefully
- [ ] Memory usage is optimal
- [ ] Async patterns follow best practices
- [ ] Error types provide meaningful context

---

**Generated**: {{generated_date}}
**Methodology**: Spec-driven development for Rust/Axum projects
**Pipeline**: claude-code-bounty-pipe