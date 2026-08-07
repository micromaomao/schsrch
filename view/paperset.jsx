/* eslint-disable lines-between-class-members, prefer-const, react/jsx-indent, react/jsx-closing-tag-location, react/jsx-no-target-blank, indent, multiline-ternary, eqeqeq */
import * as React from 'react'
import * as Subjects from './CIESubjects.js'
import PaperUtils from './paperutils.js'
import IndexContent from './indexcontent.jsx'
import { AppState } from './appstate.js'

export default class PaperSet extends React.Component {
  constructor (props) {
    super(props)
    this.state = {}
    if (AppState.getState().serverrender) {
      this.state.server = true
    }
  }
  render () {
    let set = this.props.paperSet
    let subject = Subjects.findExactById(set.subject)
    let sortedTypes
    let firstDoc = null
    // firstDoc is the doc to be displayed its content. Remaining docs will appear under "Related:"
    if (set.types[0] && set.types[0].index) {
      firstDoc = set.types[0]
    }
    // sortedTypes is all the document in this set *except* the one that gets displayed its content in full text search.
    sortedTypes = set.types.slice(firstDoc !== null ? 1 : 0).sort((a, b) => PaperUtils.funcSortType(a.type, b.type))
    let typeIcons = {
      qp: '📄',
      ms: '✅',
      er: '📝',
      gt: '📈',
      ci: '🧪',
      in: '🧪',
      sp: '📄',
      sm: '✅'
    }

    let scoreText = null
    // Relevance score text removed to avoid exposing raw internal values

    return (
      <div
        className={'set' + (this.props.mini ? ' mini' : '') + (this.props.current ? ' current' : '')}
        onClick={evt => {
          if (firstDoc !== null) {
            let page = firstDoc.index.pages ? firstDoc.index.pages[0].page : firstDoc.index.page
            this.openFile(firstDoc._id, page, firstDoc.type)
          }
        }}
        style={{ cursor: firstDoc !== null ? 'pointer' : 'default' }}
      >
        <div className='setname' style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <h3 className='doc-title' style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-color)', fontWeight: '600' }}>
              {firstDoc !== null ? PaperUtils.capitalizeFirst(PaperUtils.getTypeString(firstDoc.type)) : 'Document'}
            </h3>
            {subject ? (
               <div className='doc-subject' style={{ fontSize: '1rem', color: 'var(--color-primary)', fontWeight: '500' }}>
                 {set.subject} {subject.name}
               </div>
            ) : (
               <div className='doc-subject' style={{ fontSize: '1rem', color: 'var(--color-primary)', fontWeight: '500' }}>
                 {set.subject}
               </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {scoreText ? (
              <div className='score' style={{ color: 'var(--color-secondary-text)', fontWeight: 'normal', fontSize: '0.85rem', opacity: 0.8 }}>{scoreText}</div>
            ) : null}
            {firstDoc !== null && this.props.onTogglePreview ? (
              <button
                className='preview-btn'
                onClick={evt => {
                  evt.stopPropagation()
                  let page = firstDoc.index.pages ? firstDoc.index.pages[0].page : firstDoc.index.page
                  this.props.onTogglePreview(firstDoc._id, page, firstDoc.type)
                }}
              >
                {this.props.previewOpen ? 'Close Preview' : 'Preview'}
              </button>
            ) : null}
          </div>
        </div>
        <div className='chips-row' style={{ marginTop: '0px' }}>
          <div className='chip' style={{ color: 'var(--color-secondary-text, #888)' }}>{PaperUtils.myTimeToHumanTime(set.time)}</div>
          {set.paper !== 0 ? <div className='chip' style={{ color: 'var(--color-secondary-text, #888)' }}>Paper {set.paper}</div> : null}
          {set.variant !== 0 ? <div className='chip' style={{ color: 'var(--color-secondary-text, #888)' }}>Variant {set.variant}</div> : null}
        </div>
        {firstDoc !== null && firstDoc.index.pages
          ? (
            <div className='file first' key={firstDoc._id}>
              {firstDoc.index.pages.map((p, index) => {
                let pt = (
                  <span>
                    <span className='desc'>
                      <span className='pagenum' style={{ fontWeight: '600', color: 'var(--color-secondary-text)' }}>Page <span className='foundon'>{p.page + 1}</span></span>
                    </span>
                  </span>
                )
                return (
                  <div className='snippet-page' key={index} style={{ marginBottom: index < firstDoc.index.pages.length - 1 ? '16px' : '0' }}>
                    <div onClick={(e) => { e.stopPropagation(); this.openFile(firstDoc._id, p.page, firstDoc.type) }} style={{ cursor: 'pointer' }}>
                      {!this.state.server ? pt : (
                        <a href={this.fileUrl(firstDoc._id)} target='_blank' style={{textDecoration: 'none', color: 'inherit'}}>
                          {pt}
                        </a>
                      )}
                    </div>
                    <IndexContent highlights={p.highlight} />
                  </div>
                )
              })}
            </div>
          )
          : firstDoc !== null ? (
            <div className='file first' key={firstDoc._id}>
              {(() => {
                let pt = (
                  <span>
                    <span className='desc'>
                      <span className='pagenum' style={{ color: 'var(--color-secondary-text)' }}>Match on page <span className='foundon'>{firstDoc.index.page + 1}</span> of {firstDoc.numPages}</span>
                    </span>
                  </span>
                )
                if (!this.state.server) {
                  return pt
                } else {
                  return (
                    <a href={this.fileUrl(firstDoc._id)} target='_blank'>
                      {pt}
                    </a>
                  )
                }
              })()}
              <IndexContent content={firstDoc.index.content} search={this.props.query || ''} />
            </div>
          )
          : null}
        <div className={firstDoc !== null ? 'related' : 'files'} style={{ marginTop: '8px' }}>
          {firstDoc && sortedTypes.length > 0 ? <div style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--color-secondary-text)', opacity: 0.6 }}>Related Documents</div> : null}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {sortedTypes.map(file => {
              let pt = (
                <span
                  className='chip' style={{
                  cursor: 'pointer',
                  background: 'transparent',
                  border: '1px solid var(--border-color)',
                  color: 'var(--color-secondary-text)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 12px',
                  borderRadius: '16px',
                  fontSize: '0.85rem'
                }}
                >
                  <span className='typename'>{typeIcons[file.type] || '📄'} {PaperUtils.capitalizeFirst(PaperUtils.getTypeString(file.type))}</span>
                  <span style={{ opacity: 0.6 }}>• {file.numPages} pages</span>
                </span>
              )
              return (
                <div className='file inline' key={file._id} onClick={evt => { evt.stopPropagation(); this.openFile(file._id, this.getLastPreviewPage(file._id), file.type) }} style={{ padding: 0, display: 'inline-block' }}>
                  {!this.state.server ? pt : (
                    <a href={this.fileUrl(file._id)} target='_blank' style={{ textDecoration: 'none', color: 'inherit' }}>
                      {pt}
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  shouldComponentUpdate (nextProps, nextState) {
    if (nextState.server || this.state.server) return true
    if (nextProps.paperSet !== this.props.paperSet || nextProps.query !== this.props.query || nextProps.current !== this.props.current || nextProps.previewOpen !== this.props.previewOpen) return true
    return false
  }

  openFile (id, page = 0, type = null) {
    if (this.props.onOpenFile) {
      this.props.onOpenFile(id, page, type)
    } else {
      window.open(this.fileUrl(id))
    }
  }
  fileUrl (id) {
    return '/doc/' + encodeURIComponent(id)
  }
  getLastPreviewPage (doc) {
    let pres = AppState.getState().previewPages[doc]
    return pres || 0
  }
}
